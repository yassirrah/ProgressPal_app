package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ActivityTypeRepository extends JpaRepository<ActivityType, UUID> {

    boolean existsByNameIgnoreCase(String name);

    List<ActivityType> findByCustomFalseOrderByNameAsc();   // predefined types

    List<ActivityType> findByCreatedById(UUID userId);        // custom types of a user

    boolean existsByNameIgnoreCaseAndCreatedBy(String name, User userId);

    List<ActivityType> findByCustomTrueAndCreatedBy_IdOrderByNameAsc(UUID userId);
}