package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.Activity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ActivityRepository extends JpaRepository<Activity, UUID> {

    // examples of useful custom finders  (optional)
    List<Activity> findByUserIdOrderByStartedAtDesc(UUID userId);

    List<Activity> findByActivityTypeId(UUID activityTypeId);

    // soft-delete helper if you add an isDeleted column later
    // @Query("select a from Activity a where a.isDeleted = false")
    // List<Activity> findAllActive();
}
