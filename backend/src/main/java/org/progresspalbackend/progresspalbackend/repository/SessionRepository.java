package org.progresspalbackend.progresspalbackend.repository;


import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID>, JpaSpecificationExecutor<Session> {

    // examples of useful custom finders  (optional)
    Page<Session> findByUserIdOrderByStartedAtDesc(UUID userId, Pageable pageable);
    Page<Session> findByUserIdAndVisibilityOrderByStartedAtDesc(UUID userId, Visibility visibility, Pageable pageable);
    List<Session> findByActivityTypeId(UUID activityTypeId);
    boolean existsByActivityType_Id(UUID activityTypeId);
    boolean existsByUser_IdAndEndedAtIsNull(UUID userId);

    @EntityGraph(attributePaths = {"user", "activityType"})
    Page<Session> findByVisibilityOrderByStartedAtDesc(Visibility visibility, Pageable pageable);

    @EntityGraph(attributePaths = {"user", "activityType"})
    Page<Session> findByUser_IdInAndVisibilityOrderByStartedAtDesc(List<UUID> userIds, Visibility visibility, Pageable pageable);

    Optional<Session> findFirstByUser_IdAndEndedAtIsNullOrderByStartedAtDesc(UUID userId);

}
