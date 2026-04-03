package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequest;
import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequestStatus;
import org.progresspalbackend.progresspalbackend.domain.SessionRoomMessage;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.session.JoinRequestDecision;
import org.progresspalbackend.progresspalbackend.dto.session.MyJoinRequestDto;
import org.progresspalbackend.progresspalbackend.dto.session.RoomMessageCreateDto;
import org.progresspalbackend.progresspalbackend.dto.session.RoomMessageDto;
import org.progresspalbackend.progresspalbackend.dto.session.RoomStateDto;
import org.progresspalbackend.progresspalbackend.dto.session.RoomUserDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionJoinRequestDto;
import org.progresspalbackend.progresspalbackend.repository.SessionJoinRequestRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRoomMessageRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionJoinRoomService {

    private final SessionRepository sessionRepository;
    private final SessionAccessService sessionAccessService;
    private final SessionJoinRequestRepository sessionJoinRequestRepository;
    private final SessionRoomMessageRepository sessionRoomMessageRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public SessionJoinRequestDto createJoinRequest(UUID actorUserId, UUID sessionId) {
        Session session = sessionAccessService.requireVisibleSession(actorUserId, sessionId);
        if (session.getUser().getId().equals(actorUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot request to join your own session");
        }
        requireLive(session);

        if (sessionJoinRequestRepository.existsBySession_IdAndRequester_Id(sessionId, actorUserId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Join request already exists for this session");
        }

        User requester = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        SessionJoinRequest request = new SessionJoinRequest();
        request.setSession(session);
        request.setRequester(requester);
        request.setStatus(SessionJoinRequestStatus.PENDING);
        request.setCreatedAt(Instant.now());

        try {
            SessionJoinRequest savedRequest = sessionJoinRequestRepository.save(request);
            notificationService.notifySessionJoinRequestReceived(session.getUser(), requester, sessionId);
            return toSessionJoinRequestDto(savedRequest);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Join request already exists for this session");
        }
    }

    @Transactional(readOnly = true)
    public List<MyJoinRequestDto> listOutgoing(UUID actorUserId,
                                               SessionJoinRequestStatus status,
                                               boolean liveOnly) {
        return sessionJoinRequestRepository.findAllByRequester_IdOrderByCreatedAtDesc(actorUserId)
                .stream()
                .filter(request -> status == null || request.getStatus() == status)
                .filter(request -> !liveOnly || request.getSession().getEndedAt() == null)
                .map(this::toMyJoinRequestDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SessionJoinRequestDto> listIncoming(UUID actorUserId, UUID sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        requireHost(session, actorUserId);
        requireLive(session);

        return sessionJoinRequestRepository.findAllBySession_IdAndStatusOrderByCreatedAtDesc(
                        sessionId,
                        SessionJoinRequestStatus.PENDING
                ).stream()
                .map(this::toSessionJoinRequestDto)
                .toList();
    }

    @Transactional
    public SessionJoinRequestDto decide(UUID actorUserId,
                                        UUID sessionId,
                                        UUID requestId,
                                        JoinRequestDecision decision) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        requireHost(session, actorUserId);
        requireLive(session);

        SessionJoinRequest request = sessionJoinRequestRepository.findByIdAndSession_Id(requestId, sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Join request not found"));

        if (request.getStatus() != SessionJoinRequestStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Join request already decided");
        }

        request.setStatus(decision == JoinRequestDecision.ACCEPT
                ? SessionJoinRequestStatus.ACCEPTED
                : SessionJoinRequestStatus.REJECTED);
        request.setRespondedAt(Instant.now());
        SessionJoinRequest savedRequest = sessionJoinRequestRepository.save(request);
        notificationService.markSessionJoinRequestReceivedAsRead(
                session.getUser(),
                savedRequest.getRequester(),
                session.getId()
        );
        if (decision == JoinRequestDecision.ACCEPT) {
            notificationService.notifySessionJoinRequestAccepted(
                    savedRequest.getRequester(),
                    session.getUser(),
                    session.getId()
            );
        }
        return toSessionJoinRequestDto(savedRequest);
    }

    @Transactional(readOnly = true)
    public RoomStateDto roomState(UUID actorUserId, UUID sessionId) {
        Session session = requireRoomMemberOnLiveSession(actorUserId, sessionId);
        List<RoomUserDto> participants = sessionJoinRequestRepository
                .findAllBySession_IdAndStatusOrderByCreatedAtAsc(sessionId, SessionJoinRequestStatus.ACCEPTED)
                .stream()
                .map(SessionJoinRequest::getRequester)
                .filter(user -> !user.getId().equals(session.getUser().getId()))
                .map(this::toRoomUserDto)
                .toList();

        return new RoomStateDto(
                session.getId(),
                toRoomUserDto(session.getUser()),
                participants,
                true
        );
    }

    @Transactional(readOnly = true)
    public Page<RoomMessageDto> listRoomMessages(UUID actorUserId, UUID sessionId, Pageable pageable) {
        requireRoomMemberOnLiveSession(actorUserId, sessionId);
        return sessionRoomMessageRepository.findAllBySession_Id(sessionId, pageable)
                .map(this::toRoomMessageDto);
    }

    @Transactional
    public RoomMessageDto createRoomMessage(UUID actorUserId, UUID sessionId, RoomMessageCreateDto body) {
        Session session = requireRoomMemberOnLiveSession(actorUserId, sessionId);
        if (body == null || body.content() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content is required");
        }
        String trimmed = body.content().trim();
        if (trimmed.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content must not be blank");
        }
        if (trimmed.length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content must be at most 1000 characters");
        }

        User sender = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        SessionRoomMessage message = new SessionRoomMessage();
        message.setSession(session);
        message.setSender(sender);
        message.setContent(trimmed);
        message.setCreatedAt(Instant.now());
        SessionRoomMessage savedMessage = sessionRoomMessageRepository.save(message);
        if (!session.getUser().getId().equals(actorUserId)) {
            notificationService.notifySessionRoomMessageReceived(session.getUser(), sender, session.getId());
        }
        return toRoomMessageDto(savedMessage);
    }

    private Session requireRoomMemberOnLiveSession(UUID actorUserId, UUID sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        requireLive(session);

        if (session.getUser().getId().equals(actorUserId)) {
            return session;
        }
        if (sessionJoinRequestRepository.existsBySession_IdAndRequester_IdAndStatus(
                sessionId, actorUserId, SessionJoinRequestStatus.ACCEPTED
        )) {
            return session;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access this room");
    }

    private void requireHost(Session session, UUID actorUserId) {
        if (!session.getUser().getId().equals(actorUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only host can perform this action");
        }
    }

    private void requireLive(Session session) {
        if (session.getEndedAt() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Session is not live");
        }
    }

    private SessionJoinRequestDto toSessionJoinRequestDto(SessionJoinRequest request) {
        return new SessionJoinRequestDto(
                request.getId(),
                request.getSession().getId(),
                request.getRequester().getId(),
                request.getRequester().getUsername(),
                request.getStatus(),
                request.getCreatedAt(),
                request.getRespondedAt()
        );
    }

    private MyJoinRequestDto toMyJoinRequestDto(SessionJoinRequest request) {
        return new MyJoinRequestDto(
                request.getId(),
                request.getSession().getId(),
                request.getSession().getUser().getId(),
                request.getStatus(),
                request.getCreatedAt(),
                request.getRespondedAt()
        );
    }

    private RoomUserDto toRoomUserDto(User user) {
        return new RoomUserDto(
                user.getId(),
                user.getUsername(),
                user.getProfileImage()
        );
    }

    private RoomMessageDto toRoomMessageDto(SessionRoomMessage message) {
        User sender = message.getSender();
        return new RoomMessageDto(
                message.getId(),
                message.getSession().getId(),
                sender.getId(),
                sender.getUsername(),
                sender.getProfileImage(),
                message.getContent(),
                message.getCreatedAt()
        );
    }
}
