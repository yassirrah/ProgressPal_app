package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.ReactionType;
import org.progresspalbackend.progresspalbackend.domain.SessionReaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface SessionReactionRepository extends JpaRepository<SessionReaction, UUID> {

    long countBySession_IdAndType(UUID sessionId, ReactionType type);

    boolean existsBySession_IdAndUser_IdAndType(UUID sessionId, UUID userId, ReactionType type);

    Optional<SessionReaction> findBySession_IdAndUser_IdAndType(UUID sessionId, UUID userId, ReactionType type);

    long countByUser_IdAndSession_User_IdAndTypeAndCreatedAtAfter(
            UUID userId,
            UUID sessionOwnerId,
            ReactionType type,
            Instant createdAt
    );
}
