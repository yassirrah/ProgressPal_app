package org.progresspalbackend.progresspalbackend.service;

import jakarta.transaction.Transactional;
import org.progresspalbackend.progresspalbackend.domain.FriendRequest;
import org.progresspalbackend.progresspalbackend.domain.Friendship;
import org.progresspalbackend.progresspalbackend.domain.FriendshipStatus;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendRequestDto;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendShipDto;
import org.progresspalbackend.progresspalbackend.mapper.FriendshipMapper;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRequestRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
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
        FriendRequest friendRequest = friendRequestRepository
                .findFirstByRequester_IdAndReceiver_IdAndStatusOrderByCreatedAtDesc(
                        requesterId,
                        receiverId,
                        FriendshipStatus.PENDING
                )
                .orElse(null);

        if (friendRequest == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No friend request found");
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
        try {
            friendRepository.saveAndFlush(new_friendship);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Users are already friends");
        }
    }

    @Transactional
    public void rejectRequest(UUID actorUserId, UUID requesterId) {
        UUID receiverId = actorUserId;
        FriendRequest friendRequest = friendRequestRepository
                .findFirstByRequester_IdAndReceiver_IdAndStatusOrderByCreatedAtDesc(
                        requesterId,
                        receiverId,
                        FriendshipStatus.PENDING
                )
                .orElse(null);

        if (friendRequest == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No friend request found");
        }

        friendRequest.setStatus(FriendshipStatus.REJECTED);
        friendRequestRepository.save(friendRequest);
    }

    @Transactional
    public List<FriendShipDto> getAll(UUID userId) {
        List<FriendShipDto> fromUserSide = friendRepository.findAllByUser_Id(userId)
                .stream()
                .map(mapper::toDtoFromUserSide)
                .toList();

        List<FriendShipDto> fromFriendSide = friendRepository.findAllByFriend_Id(userId)
                .stream()
                .map(mapper::toDtoFromFriendSide)
                .toList();

        List<FriendShipDto> all = new java.util.ArrayList<>(fromUserSide);
        all.addAll(fromFriendSide);

        return all.stream()
                .distinct()
                .toList();
    }

    public List<FriendRequestDto> getIncomingPendingRequests(UUID userId) {
        return friendRequestRepository.findAllByReceiver_IdAndStatus(userId, FriendshipStatus.PENDING)
                .stream()
                .map(req -> new FriendRequestDto(
                        req.getRequester().getId(),
                        req.getRequester().getUsername(),
                        req.getCreatedAt()
                ))
                .toList();
    }

    @Transactional
    public void deleteFriend(UUID actorUserId, UUID friendId) {
        Friendship direct = friendRepository.findByUser_IdAndFriend_Id(actorUserId, friendId);
        Friendship reverse = friendRepository.findByUser_IdAndFriend_Id(friendId, actorUserId);

        if (direct == null && reverse == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Friendship not found");
        }

        if (direct != null) {
            friendRepository.delete(direct);
        }
        if (reverse != null && (direct == null || !reverse.getId().equals(direct.getId()))) {
            friendRepository.delete(reverse);
        }
    }
}
