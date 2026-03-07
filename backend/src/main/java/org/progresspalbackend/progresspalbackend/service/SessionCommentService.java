package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.SessionComment;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.comment.SessionCommentCreateDto;
import org.progresspalbackend.progresspalbackend.dto.comment.SessionCommentDto;
import org.progresspalbackend.progresspalbackend.repository.SessionCommentRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionCommentService {

    private static final int MAX_COMMENT_LENGTH = 1000;

    private final SessionCommentRepository sessionCommentRepository;
    private final SessionAccessService sessionAccessService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<SessionCommentDto> list(UUID actorUserId, UUID sessionId) {
        Session session = sessionAccessService.requireVisibleSession(actorUserId, sessionId);
        return sessionCommentRepository.findAllBySession_IdOrderByCreatedAtDesc(session.getId())
                .stream()
                .map(comment -> toDto(comment, actorUserId))
                .toList();
    }

    public SessionCommentDto create(UUID actorUserId, UUID sessionId, SessionCommentCreateDto dto) {
        if (dto == null || dto.content() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content is required");
        }

        String content = dto.content().trim();
        if (content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content cannot be blank");
        }
        if (content.length() > MAX_COMMENT_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content is too long");
        }

        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Session session = sessionAccessService.requireVisibleSession(actorUserId, sessionId);

        SessionComment comment = new SessionComment();
        comment.setSession(session);
        comment.setAuthor(actor);
        comment.setContent(content);
        comment.setCreatedAt(Instant.now());

        SessionComment saved = sessionCommentRepository.save(comment);

        notificationService.notifySessionComment(session.getUser(), actor, saved.getId());

        return toDto(saved, actorUserId);
    }

    public void delete(UUID actorUserId, UUID sessionId, UUID commentId) {
        Session session = sessionAccessService.requireVisibleSession(actorUserId, sessionId);
        SessionComment comment = sessionCommentRepository.findByIdAndSession_Id(commentId, sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        boolean isAuthor = comment.getAuthor().getId().equals(actorUserId);
        boolean isSessionOwner = session.getUser().getId().equals(actorUserId);

        if (!isAuthor && !isSessionOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot delete this comment");
        }

        sessionCommentRepository.delete(comment);
    }

    private SessionCommentDto toDto(SessionComment comment, UUID actorUserId) {
        User author = comment.getAuthor();
        return new SessionCommentDto(
                comment.getId(),
                comment.getSession().getId(),
                author.getId(),
                author.getUsername(),
                author.getProfileImage(),
                comment.getContent(),
                comment.getCreatedAt(),
                comment.getUpdatedAt(),
                author.getId().equals(actorUserId)
        );
    }
}
