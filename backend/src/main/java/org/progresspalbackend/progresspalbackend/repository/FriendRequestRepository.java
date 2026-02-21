package org.progresspalbackend.progresspalbackend.repository;

import org.progresspalbackend.progresspalbackend.domain.FriendRequest;
import org.progresspalbackend.progresspalbackend.domain.FriendshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, UUID> {
    FriendRequest findByRequester_IdAndReceiver_Id(UUID requesterId, UUID receiverId);
    boolean existsByRequester_IdAndReceiver_IdAndStatus(UUID requesterId, UUID receiverId, FriendshipStatus status);
    List<FriendRequest> findAllByReceiver_IdAndStatus(UUID receiverId, FriendshipStatus status);
}
