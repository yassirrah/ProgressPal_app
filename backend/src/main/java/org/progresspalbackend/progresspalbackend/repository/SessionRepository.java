package org.progresspalbackend.progresspalbackend.repository;


import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {

    // examples of useful custom finders  (optional)
    Page<Session> findByUserIdOrderByStartedAtDesc(UUID userId, Pageable pageable);
    Page<Session> findByUserIdAndVisibilityOrderByStartedAtDesc(UUID userId, Visibility visibility, Pageable pageable);
    List<Session> findByActivityTypeId(UUID activityTypeId);
    boolean existsByUser_IdAndEndedAtIsNull(UUID userId);


    @EntityGraph(attributePaths = {"user", "activityType"})
    Page<Session> findByVisibilityOrderByStartedAtDesc(Visibility visibility, Pageable pageable);
}
