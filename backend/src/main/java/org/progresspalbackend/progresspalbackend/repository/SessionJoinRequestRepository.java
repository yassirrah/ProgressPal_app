package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequest;
import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionJoinRequestRepository extends JpaRepository<SessionJoinRequest, UUID> {

    boolean existsBySession_IdAndRequester_Id(UUID sessionId, UUID requesterId);

    boolean existsBySession_IdAndRequester_IdAndStatus(UUID sessionId, UUID requesterId, SessionJoinRequestStatus status);

    Optional<SessionJoinRequest> findByIdAndSession_Id(UUID id, UUID sessionId);

    List<SessionJoinRequest> findAllByRequester_IdOrderByCreatedAtDesc(UUID requesterId);

    List<SessionJoinRequest> findAllBySession_IdAndStatusOrderByCreatedAtDesc(UUID sessionId, SessionJoinRequestStatus status);

    List<SessionJoinRequest> findAllBySession_IdAndStatusOrderByCreatedAtAsc(UUID sessionId, SessionJoinRequestStatus status);
}
