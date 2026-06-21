package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.SessionComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionCommentRepository extends JpaRepository<SessionComment, UUID> {

    List<SessionComment> findAllBySession_IdOrderByCreatedAtDesc(UUID sessionId);

    Optional<SessionComment> findByIdAndSession_Id(UUID id, UUID sessionId);

    @Query("""
            select comment.session.id as sessionId, count(comment.id) as count
            from SessionComment comment
            where comment.session.id in :sessionIds
            group by comment.session.id
            """)
    List<SessionAggregateCount> countBySessionIds(@Param("sessionIds") Collection<UUID> sessionIds);

    long countByAuthor_IdAndSession_User_IdAndCreatedAtAfter(UUID authorId, UUID sessionOwnerId, Instant createdAt);
}
