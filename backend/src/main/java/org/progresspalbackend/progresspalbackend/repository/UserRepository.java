package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {}