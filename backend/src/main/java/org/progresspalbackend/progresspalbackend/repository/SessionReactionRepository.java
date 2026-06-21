package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.ReactionType;
import org.progresspalbackend.progresspalbackend.domain.SessionReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface SessionReactionRepository extends JpaRepository<SessionReaction, UUID> {

    long countBySession_IdAndType(UUID sessionId, ReactionType type);

    boolean existsBySession_IdAndUser_IdAndType(UUID sessionId, UUID userId, ReactionType type);

    Optional<SessionReaction> findBySession_IdAndUser_IdAndType(UUID sessionId, UUID userId, ReactionType type);

    @Query("""
            select reaction.session.id as sessionId, count(reaction.id) as count
            from SessionReaction reaction
            where reaction.session.id in :sessionIds
              and reaction.type = :type
            group by reaction.session.id
            """)
    List<SessionAggregateCount> countBySessionIdsAndType(
            @Param("sessionIds") Collection<UUID> sessionIds,
            @Param("type") ReactionType type
    );

    @Query("""
            select reaction.session.id
            from SessionReaction reaction
            where reaction.session.id in :sessionIds
              and reaction.user.id = :userId
              and reaction.type = :type
            """)
    Set<UUID> findSessionIdsReactedByUser(
            @Param("sessionIds") Collection<UUID> sessionIds,
            @Param("userId") UUID userId,
            @Param("type") ReactionType type
    );

    long countByUser_IdAndSession_User_IdAndTypeAndCreatedAtAfter(
            UUID userId,
            UUID sessionOwnerId,
            ReactionType type,
            Instant createdAt
    );
}
