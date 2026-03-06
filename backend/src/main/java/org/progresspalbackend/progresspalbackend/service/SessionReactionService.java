package org.progresspalbackend.progresspalbackend.service;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.ReactionType;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.SessionReaction;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.reaction.SessionLikeSummaryDto;
import org.progresspalbackend.progresspalbackend.repository.SessionReactionRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SessionReactionService {

    private final SessionReactionRepository sessionReactionRepository;
    private final SessionAccessService sessionAccessService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public SessionLikeSummaryDto getLikesSummary(UUID actorUserId, UUID sessionId) {
        sessionAccessService.requireVisibleSession(actorUserId, sessionId);
        long count = sessionReactionRepository.countBySession_IdAndType(sessionId, ReactionType.LIKE);
        boolean likedByMe = sessionReactionRepository.existsBySession_IdAndUser_IdAndType(
                sessionId,
                actorUserId,
                ReactionType.LIKE
        );
        return new SessionLikeSummaryDto(sessionId, count, likedByMe);
    }

    public SessionLikeSummaryDto like(UUID actorUserId, UUID sessionId) {
        Session session = sessionAccessService.requireVisibleSession(actorUserId, sessionId);

        boolean alreadyLiked = sessionReactionRepository.existsBySession_IdAndUser_IdAndType(
                sessionId,
                actorUserId,
                ReactionType.LIKE
        );
        if (alreadyLiked) {
            return getLikesSummary(actorUserId, sessionId);
        }

        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        SessionReaction reaction = new SessionReaction();
        reaction.setSession(session);
        reaction.setUser(actor);
        reaction.setType(ReactionType.LIKE);
        reaction.setCreatedAt(Instant.now());

        SessionReaction saved = sessionReactionRepository.save(reaction);
        notificationService.notifySessionLike(session.getUser(), actor, saved.getId());

        return getLikesSummary(actorUserId, sessionId);
    }

    public SessionLikeSummaryDto unlike(UUID actorUserId, UUID sessionId) {
        sessionAccessService.requireVisibleSession(actorUserId, sessionId);
        sessionReactionRepository.findBySession_IdAndUser_IdAndType(sessionId, actorUserId, ReactionType.LIKE)
                .ifPresent(sessionReactionRepository::delete);
        return getLikesSummary(actorUserId, sessionId);
    }
}
