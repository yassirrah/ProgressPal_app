package org.progresspalbackend.progresspalbackend.service;

import jakarta.transaction.Transactional;
import org.progresspalbackend.progresspalbackend.domain.FriendRequest;
import org.progresspalbackend.progresspalbackend.domain.Friendship;
import org.progresspalbackend.progresspalbackend.domain.FriendshipStatus;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendShipDto;
import org.progresspalbackend.progresspalbackend.mapper.FriendshipMapper;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRequestRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class FriendShipService {

    private final FriendRepository friendRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final FriendshipMapper mapper;
    private final UserRepository userRepo;

    public FriendShipService(FriendRepository friendRepository, FriendshipMapper mapper, UserRepository userRepo,FriendRequestRepository friendRequestRepository) {
        this.friendRepository = friendRepository;
        this.mapper = mapper;
        this.userRepo = userRepo;
        this.friendRequestRepository = friendRequestRepository;

    }

    public void sendRequest(UUID requesterId, UUID receiverId){
        if(requesterId.equals(receiverId)){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot send friend request to yourself");
        }

        if(friendRepository.existsByUser_IdAndFriend_Id(requesterId, receiverId)
                || friendRepository.existsByUser_IdAndFriend_Id(receiverId, requesterId)){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are already friends");
        }
        boolean hasPendingDirect = friendRequestRepository.existsByRequester_IdAndReceiver_IdAndStatus(
                requesterId, receiverId, FriendshipStatus.PENDING);
        boolean hasPendingReverse = friendRequestRepository.existsByRequester_IdAndReceiver_IdAndStatus(
                receiverId, requesterId, FriendshipStatus.PENDING);

        if(hasPendingDirect || hasPendingReverse){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You have already sent this person a friend request");
        }

        User requester = userRepo.findById(requesterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Requester not found"));
        User friend = userRepo.findById(receiverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Receiver not found"));
        FriendRequest friendRequest = new FriendRequest(
                null,
                requester,
                friend,
                FriendshipStatus.PENDING,
                Instant.now()
        );
        friendRequestRepository.save(friendRequest);
    }

    @Transactional
    public void acceptRequest(UUID actorUserId, UUID requesterId){
        UUID receiverId = actorUserId;
        FriendRequest friendRequest = friendRequestRepository.findByRequester_IdAndReceiver_Id(requesterId, receiverId);

        if(friendRequest == null){
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No friend request found");
        }
        if(friendRequest.getStatus() != FriendshipStatus.PENDING){
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Request is not pending");
        }

        boolean alreadyFriends =
                friendRepository.existsByUser_IdAndFriend_Id(requesterId, receiverId) ||
                        friendRepository.existsByUser_IdAndFriend_Id(receiverId, requesterId);

        if (alreadyFriends) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Users are already friends");
        }

        friendRequest.setStatus(FriendshipStatus.ACCEPTED);
        friendRequestRepository.save(friendRequest);

        User requester = userRepo.findById(requesterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Requester not found"));
        User receiver = userRepo.findById(receiverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Receiver not found"));

        Friendship new_friendship = new Friendship(
                null,
                requester,
                receiver,
                Instant.now()
        );
        friendRepository.save(new_friendship);
    }

    public List<FriendShipDto> getAll(UUID userId) {
        List<Friendship> rows = new java.util.ArrayList<>();
        rows.addAll(friendRepository.findAllByUser_Id(userId));
        rows.addAll(friendRepository.findAllByFriend_Id(userId));

        return rows.stream()
                .map(f -> {
                    UUID otherId = f.getUser().getId().equals(userId)
                            ? f.getFriend().getId()
                            : f.getUser().getId();
                    return new FriendShipDto(otherId, f.getCreatedAt());
                })
                .distinct()
                .toList();
    }



}
