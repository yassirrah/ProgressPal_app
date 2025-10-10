package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ActivityTypeRepository extends JpaRepository<ActivityType, UUID> {

    boolean existsByNameIgnoreCase(String name);

    List<ActivityType> findByIsCustomFalseOrderByNameAsc();   // predefined types

    List<ActivityType> findByCreatedById(UUID userId);        // custom types of a user
}