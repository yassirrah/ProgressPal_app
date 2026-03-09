package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.SessionComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionCommentRepository extends JpaRepository<SessionComment, UUID> {

    List<SessionComment> findAllBySession_IdOrderByCreatedAtDesc(UUID sessionId);

    Optional<SessionComment> findByIdAndSession_Id(UUID id, UUID sessionId);

    long countByAuthor_IdAndSession_User_IdAndCreatedAtAfter(UUID authorId, UUID sessionOwnerId, Instant createdAt);
}
