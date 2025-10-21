package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.Session;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {

    // examples of useful custom finders  (optional)
    List<Session> findByUserIdOrderByStartedAtDesc(UUID userId);

    List<Session> findByActivityTypeId(UUID activityTypeId);

    // soft-delete helper if you add an isDeleted column later
    // @Query("select a from Activity a where a.isDeleted = false")
    // List<Activity> findAllActive();
}
