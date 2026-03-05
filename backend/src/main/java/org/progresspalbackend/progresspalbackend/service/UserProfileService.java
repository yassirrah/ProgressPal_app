package org.progresspalbackend.progresspalbackend.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.domain.Session;
import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.dto.dashboard.TopActivityTypeByTimeDto;
import org.progresspalbackend.progresspalbackend.dto.user.UserProfileDto;
import org.progresspalbackend.progresspalbackend.dto.user.UserProfileRecentSessionDto;
import org.progresspalbackend.progresspalbackend.dto.user.UserProfileStatsDto;
import org.progresspalbackend.progresspalbackend.repository.FriendRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final FriendRepository friendRepository;

    @Transactional
    public UserProfileDto getProfile(UUID actorUserId, UUID targetUserId) {
        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        ProfileScope scope = resolveScope(actorUserId, targetUserId);
        List<Visibility> visibleVisibilities = visibleVisibilities(scope);

        List<Session> visibleSessions = scope == ProfileScope.OWNER
                ? sessionRepository.findByUserId(targetUserId)
                : sessionRepository.findByUserIdAndVisibilityIn(targetUserId, visibleVisibilities);

        List<Session> recentSessions = scope == ProfileScope.OWNER
                ? sessionRepository.findByUserIdOrderByStartedAtDesc(targetUserId, PageRequest.of(0, 5)).getContent()
                : sessionRepository.findByUserIdAndVisibilityInOrderByStartedAtDesc(targetUserId, visibleVisibilities, PageRequest.of(0, 5)).getContent();

        Instant now = Instant.now();
        long totalVisibleDurationSeconds = 0L;
        Map<UUID, ActivityDurationAggregate> durationByActivityType = new HashMap<>();

        for (Session session : visibleSessions) {
            long durationSeconds = computeEffectiveDurationSeconds(session, now);
            totalVisibleDurationSeconds += durationSeconds;

            UUID activityTypeId = session.getActivityType().getId();
            ActivityDurationAggregate aggregate = durationByActivityType.computeIfAbsent(
                    activityTypeId,
                    ignored -> new ActivityDurationAggregate(activityTypeId, session.getActivityType().getName())
            );
            aggregate.totalDurationSeconds += durationSeconds;
        }

        List<TopActivityTypeByTimeDto> topActivityTypesByVisibleDuration = durationByActivityType.values().stream()
                .sorted(Comparator
                        .comparingLong(ActivityDurationAggregate::getTotalDurationSeconds).reversed()
                        .thenComparing(ActivityDurationAggregate::getActivityTypeName)
                        .thenComparing(ActivityDurationAggregate::getActivityTypeId))
                .limit(3)
                .map(aggregate -> new TopActivityTypeByTimeDto(
                        aggregate.activityTypeId,
                        aggregate.activityTypeName,
                        aggregate.totalDurationSeconds
                ))
                .toList();

        List<UserProfileRecentSessionDto> recentSessionDtos = recentSessions.stream()
                .map(session -> new UserProfileRecentSessionDto(
                        session.getId(),
                        session.getActivityType().getId(),
                        session.getActivityType().getName(),
                        session.getTitle(),
                        session.getStartedAt(),
                        session.getEndedAt(),
                        computeEffectiveDurationSeconds(session, now),
                        session.getVisibility()
                ))
                .toList();

        UserProfileStatsDto stats = new UserProfileStatsDto(
                visibleSessions.size(),
                totalVisibleDurationSeconds,
                topActivityTypesByVisibleDuration,
                recentSessionDtos
        );

        return new UserProfileDto(
                targetUser.getId(),
                targetUser.getUsername(),
                targetUser.getBio(),
                targetUser.getProfileImage(),
                scope.name(),
                stats
        );
    }

    private ProfileScope resolveScope(UUID actorUserId, UUID targetUserId) {
        if (actorUserId.equals(targetUserId)) {
            return ProfileScope.OWNER;
        }

        boolean areFriends = friendRepository.existsByUser_IdAndFriend_Id(actorUserId, targetUserId)
                || friendRepository.existsByUser_IdAndFriend_Id(targetUserId, actorUserId);
        return areFriends ? ProfileScope.FRIEND : ProfileScope.PUBLIC;
    }

    private List<Visibility> visibleVisibilities(ProfileScope scope) {
        if (scope == ProfileScope.FRIEND) {
            return List.of(Visibility.PUBLIC, Visibility.FRIENDS);
        }
        if (scope == ProfileScope.PUBLIC) {
            return List.of(Visibility.PUBLIC);
        }
        return new ArrayList<>(List.of(Visibility.PUBLIC, Visibility.FRIENDS, Visibility.PRIVATE));
    }

    private long computeEffectiveDurationSeconds(Session session, Instant now) {
        Instant end = session.getEndedAt() == null ? now : session.getEndedAt();
        long rawSeconds = Math.max(0, Duration.between(session.getStartedAt(), end).getSeconds());

        long pausedSeconds = session.getPausedDurationSeconds() == null ? 0L : session.getPausedDurationSeconds();
        if (session.getPausedAt() != null) {
            pausedSeconds += Math.max(0, Duration.between(session.getPausedAt(), end).getSeconds());
        }

        return Math.max(0, rawSeconds - pausedSeconds);
    }

    private enum ProfileScope {
        OWNER,
        FRIEND,
        PUBLIC
    }

    private static class ActivityDurationAggregate {
        private final UUID activityTypeId;
        private final String activityTypeName;
        private long totalDurationSeconds;

        private ActivityDurationAggregate(UUID activityTypeId, String activityTypeName) {
            this.activityTypeId = activityTypeId;
            this.activityTypeName = activityTypeName;
            this.totalDurationSeconds = 0L;
        }

        private UUID getActivityTypeId() {
            return activityTypeId;
        }

        private String getActivityTypeName() {
            return activityTypeName;
        }

        private long getTotalDurationSeconds() {
            return totalDurationSeconds;
        }
    }
}
