package org.progresspalbackend.progresspalbackend.service;

import org.progresspalbackend.progresspalbackend.domain.FriendRequest;
import org.progresspalbackend.progresspalbackend.domain.Friendship;
import org.progresspalbackend.progresspalbackend.domain.FriendshipStatus;
import org.progresspalbackend.progresspalbackend.domain.ReactionType;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendRequestDto;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendShipDto;
import org.progresspalbackend.progresspalbackend.dto.Friendship.FriendSuggestionDto;
import org.progresspalbackend.progresspalbackend.mapper.FriendshipMapper;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.FriendRequestRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionCommentRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionReactionRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class FriendShipService {

    private static final int MUTUAL_FRIEND_WEIGHT = 6;
    private static final int SHARED_ACTIVITY_WEIGHT = 3;
    private static final int INTERACTION_WEIGHT = 2;
    private static final int RECENT_ACTIVITY_WEIGHT = 1;
    private static final int MAX_SUGGESTION_LIMIT = 30;

    private final FriendRepository friendRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final FriendshipMapper mapper;
    private final UserRepository userRepo;
    private final SessionRepository sessionRepository;
    private final SessionCommentRepository sessionCommentRepository;
    private final SessionReactionRepository sessionReactionRepository;
    private final NotificationService notificationService;

    public FriendShipService(FriendRepository friendRepository,
                             FriendshipMapper mapper,
                             UserRepository userRepo,
                             FriendRequestRepository friendRequestRepository,
                             SessionRepository sessionRepository,
                             SessionCommentRepository sessionCommentRepository,
                             SessionReactionRepository sessionReactionRepository,
                             NotificationService notificationService) {
        this.friendRepository = friendRepository;
        this.mapper = mapper;
        this.userRepo = userRepo;
        this.friendRequestRepository = friendRequestRepository;
        this.sessionRepository = sessionRepository;
        this.sessionCommentRepository = sessionCommentRepository;
        this.sessionReactionRepository = sessionReactionRepository;
        this.notificationService = notificationService;
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
        friendRequest = friendRequestRepository.save(friendRequest);
        notificationService.notifyFriendRequestReceived(friend, requester, friendRequest.getId());
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

        notificationService.notifyFriendRequestAccepted(requester, receiver, friendRequest.getId());
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

    @Transactional(readOnly = true)
    public List<FriendSuggestionDto> getSuggestions(UUID actorUserId, int limit) {
        userRepo.findById(actorUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        int cappedLimit = Math.max(1, Math.min(limit, MAX_SUGGESTION_LIMIT));

        List<Friendship> allFriendships = friendRepository.findAll();
        Map<UUID, Set<UUID>> friendGraph = buildFriendGraph(allFriendships);
        Set<UUID> actorFriendIds = friendGraph.getOrDefault(actorUserId, Set.of());

        Set<UUID> excludedIds = new HashSet<>(actorFriendIds);
        excludedIds.add(actorUserId);

        friendRequestRepository.findAllByRequester_IdAndStatus(actorUserId, FriendshipStatus.PENDING)
                .forEach(request -> excludedIds.add(request.getReceiver().getId()));
        friendRequestRepository.findAllByReceiver_IdAndStatus(actorUserId, FriendshipStatus.PENDING)
                .forEach(request -> excludedIds.add(request.getRequester().getId()));

        List<User> candidates = userRepo.findAll()
                .stream()
                .filter(candidate -> !excludedIds.contains(candidate.getId()))
                .toList();

        if (candidates.isEmpty()) {
            return List.of();
        }

        Instant now = Instant.now();
        Instant cutoff30d = now.minus(30, ChronoUnit.DAYS);
        Instant cutoff7d = now.minus(7, ChronoUnit.DAYS);

        Map<UUID, Set<UUID>> userActivityTypes = new HashMap<>();
        Set<UUID> recentlyActiveUserIds = new HashSet<>();
        for (Session session : sessionRepository.findByStartedAtAfter(cutoff30d)) {
            if (session.getUser() == null || session.getActivityType() == null) {
                continue;
            }
            UUID userId = session.getUser().getId();
            UUID activityTypeId = session.getActivityType().getId();
            userActivityTypes.computeIfAbsent(userId, ignored -> new HashSet<>()).add(activityTypeId);

            Instant startedAt = session.getStartedAt();
            if (startedAt != null && !startedAt.isBefore(cutoff7d)) {
                recentlyActiveUserIds.add(userId);
            }
        }

        Set<UUID> actorActivityTypes = userActivityTypes.getOrDefault(actorUserId, Set.of());

        List<ScoredSuggestion> scoredSuggestions = new ArrayList<>();
        for (User candidate : candidates) {
            UUID candidateId = candidate.getId();
            Set<UUID> candidateFriends = friendGraph.getOrDefault(candidateId, Set.of());
            int mutualFriends = countOverlap(actorFriendIds, candidateFriends);
            int sharedActivityTypes = countOverlap(
                    actorActivityTypes,
                    userActivityTypes.getOrDefault(candidateId, Set.of())
            );
            int interactionCount = countInteractions(actorUserId, candidateId, cutoff30d);
            boolean recentlyActive = recentlyActiveUserIds.contains(candidateId);

            int score = (mutualFriends * MUTUAL_FRIEND_WEIGHT)
                    + (sharedActivityTypes * SHARED_ACTIVITY_WEIGHT)
                    + (interactionCount * INTERACTION_WEIGHT)
                    + (recentlyActive ? RECENT_ACTIVITY_WEIGHT : 0);

            List<String> reasons = buildReasons(mutualFriends, sharedActivityTypes, interactionCount, recentlyActive);

            scoredSuggestions.add(new ScoredSuggestion(
                    candidate,
                    score,
                    mutualFriends,
                    sharedActivityTypes,
                    interactionCount,
                    recentlyActive,
                    reasons
            ));
        }

        return scoredSuggestions.stream()
                .sorted(Comparator
                        .comparingInt(ScoredSuggestion::score).reversed()
                        .thenComparing(suggestion -> suggestion.user().getUsername(), String.CASE_INSENSITIVE_ORDER))
                .limit(cappedLimit)
                .map(suggestion -> new FriendSuggestionDto(
                        suggestion.user().getId(),
                        suggestion.user().getUsername(),
                        suggestion.user().getProfileImage(),
                        suggestion.score(),
                        suggestion.mutualFriends(),
                        suggestion.sharedActivityTypes(),
                        suggestion.interactionCount(),
                        suggestion.recentlyActive(),
                        suggestion.reasons()
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

    private Map<UUID, Set<UUID>> buildFriendGraph(List<Friendship> friendships) {
        Map<UUID, Set<UUID>> graph = new HashMap<>();
        for (Friendship friendship : friendships) {
            UUID userId = friendship.getUser().getId();
            UUID friendId = friendship.getFriend().getId();
            graph.computeIfAbsent(userId, ignored -> new HashSet<>()).add(friendId);
            graph.computeIfAbsent(friendId, ignored -> new HashSet<>()).add(userId);
        }
        return graph;
    }

    private int countInteractions(UUID actorUserId, UUID candidateId, Instant cutoff) {
        long comments = sessionCommentRepository.countByAuthor_IdAndSession_User_IdAndCreatedAtAfter(
                actorUserId,
                candidateId,
                cutoff
        ) + sessionCommentRepository.countByAuthor_IdAndSession_User_IdAndCreatedAtAfter(
                candidateId,
                actorUserId,
                cutoff
        );

        long likes = sessionReactionRepository.countByUser_IdAndSession_User_IdAndTypeAndCreatedAtAfter(
                actorUserId,
                candidateId,
                ReactionType.LIKE,
                cutoff
        ) + sessionReactionRepository.countByUser_IdAndSession_User_IdAndTypeAndCreatedAtAfter(
                candidateId,
                actorUserId,
                ReactionType.LIKE,
                cutoff
        );

        long total = comments + likes;
        if (total > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return (int) total;
    }

    private int countOverlap(Set<UUID> left, Set<UUID> right) {
        if (left.isEmpty() || right.isEmpty()) {
            return 0;
        }
        Set<UUID> smaller = left.size() <= right.size() ? left : right;
        Set<UUID> bigger = smaller == left ? right : left;
        int overlap = 0;
        for (UUID value : smaller) {
            if (bigger.contains(value)) {
                overlap += 1;
            }
        }
        return overlap;
    }

    private List<String> buildReasons(int mutualFriends, int sharedActivityTypes, int interactionCount, boolean recentlyActive) {
        List<String> reasons = new ArrayList<>();
        if (mutualFriends > 0) {
            reasons.add(mutualFriends + (mutualFriends == 1 ? " mutual friend" : " mutual friends"));
        }
        if (sharedActivityTypes > 0) {
            reasons.add("Shared activity types");
        }
        if (interactionCount > 0) {
            reasons.add("Recent interactions");
        }
        if (recentlyActive) {
            reasons.add("Recently active");
        }
        if (reasons.isEmpty()) {
            reasons.add("New to your network");
        }
        return reasons;
    }

    private record ScoredSuggestion(
            User user,
            int score,
            int mutualFriends,
            int sharedActivityTypes,
            int interactionCount,
            boolean recentlyActive,
            List<String> reasons
    ) {
    }
}
