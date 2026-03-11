package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.SessionRoomMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SessionRoomMessageRepository extends JpaRepository<SessionRoomMessage, UUID> {

    Page<SessionRoomMessage> findAllBySession_Id(UUID sessionId, Pageable pageable);
}
