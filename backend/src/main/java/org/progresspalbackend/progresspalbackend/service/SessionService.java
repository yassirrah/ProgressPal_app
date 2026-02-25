package org.progresspalbackend.progresspalbackend.service;

import jakarta.annotation.Nullable;
import jakarta.transaction.Status;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;


import org.mapstruct.Mapper;
import org.progresspalbackend.progresspalbackend.domain.ActivityType;
import org.progresspalbackend.progresspalbackend.domain.MetricKind;
import org.progresspalbackend.progresspalbackend.domain.Session;

import org.progresspalbackend.progresspalbackend.domain.User;
import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.dto.feed.FeedSessionDto;
import org.progresspalbackend.progresspalbackend.dto.dashboard.MeDashboardSummaryDto;
import org.progresspalbackend.progresspalbackend.dto.dashboard.TopActivityTypeByTimeDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionCreateDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionStopDto;
import org.progresspalbackend.progresspalbackend.mapper.SessionMapper;
import org.progresspalbackend.progresspalbackend.repository.ActivityTypeRepository;
import org.progresspalbackend.progresspalbackend.repository.SessionRepository;
import org.progresspalbackend.progresspalbackend.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepo;
    private final UserRepository userRepo;
    private final ActivityTypeRepository typeRepo;
    private final SessionMapper mapper;
    private final ActivityTypeRepository activityTypeRepository;

    public SessionDto create(SessionCreateDto dto, UUID user_id) {
        if(dto.activityTypeId() == null){
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "activityTypeId cannot be null");
        }
        Session entity = mapper.toEntity(dto);

        User user = userRepo.findById(user_id).
                orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        ActivityType activityType = activityTypeRepository.findById(dto.activityTypeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "ActivityType not found"));


        if(sessionRepo.existsByUser_IdAndEndedAtIsNull(user_id)){
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already has a live session");
        }

        entity.setUser(user);
        entity.setActivityType(activityType);
        entity.setStartedAt(Instant.now());
        return mapper.toDto(sessionRepo.save(entity));
    }

    public List<SessionDto> findAll() {
        return sessionRepo.findAll().stream().map(mapper::toDto).toList();
    }

    public SessionDto update(UUID id, SessionCreateDto dto, UUID actor_user_id) {
        Session existing = sessionRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        // simple field updates
        existing.setTitle(dto.title());
        existing.setDescription(dto.description());
        existing.setVisibility(dto.visibility());

        // relation updates (only if changed)
        if (!existing.getUser().getId().equals(actor_user_id)) {
            existing.setUser(userRepo.getReferenceById(actor_user_id));
        }
        if (!existing.getActivityType().getId().equals(dto.activityTypeId())) {
            existing.setActivityType(typeRepo.getReferenceById(dto.activityTypeId()));
        }

        return mapper.toDto(sessionRepo.save(existing));
    }

    @Transactional
    public SessionDto stop(UUID id, UUID actorUserId, SessionStopDto body) {
        Session s = sessionRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));

        if(!s.getUser().getId().equals(actorUserId)){
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot stop another user's session");
        }

        if(s.getEndedAt() != null){
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Session already stopped");
        }
        validateStopMetric(s.getActivityType(), body.metricValue());
        s.setEndedAt(Instant.now());
        s.setMetricValue(body.metricValue());
        return mapper.toDto(sessionRepo.save(s));
    }

    public Page<SessionDto> findVisibleSessions(UUID actorUserId, UUID targetUserId, @Nullable Visibility visibility, Pageable pageable){
        boolean isOwner = targetUserId.equals(actorUserId);
        Page<Session> sessions;
        if(isOwner) {
            if (visibility == null) {
                sessions = sessionRepo.findByUserIdOrderByStartedAtDesc(targetUserId, pageable);
            } else {
                sessions = sessionRepo.findByUserIdAndVisibilityOrderByStartedAtDesc(targetUserId, visibility, pageable);
            }
        }else{
            sessions = sessionRepo.findByUserIdAndVisibilityOrderByStartedAtDesc(targetUserId, Visibility.PUBLIC, pageable);
        }
        return sessions.map(mapper::toDto);
    }

    public Page<FeedSessionDto> getFeedSessions(Pageable pageable){
        return sessionRepo.findByVisibilityOrderByStartedAtDesc(Visibility.PUBLIC, pageable)
                .map(s -> new FeedSessionDto(
                    s.getId(),
                    s.getUser().getId(),
                    s.getUser().getUsername(),
                    s.getActivityType().getId(),
                    s.getActivityType().getName(),
                    s.getTitle(),
                    s.getMetricValue(),
                    s.getActivityType().getMetricLabel(),
                    s.getStartedAt(),
                    s.getEndedAt(),
                    s.getVisibility())
                );
    }

    public Optional<SessionDto> getLiveSessionOfUser(UUID actorUserId) {
        return sessionRepo.findFirstByUser_IdAndEndedAtIsNullOrderByStartedAtDesc(actorUserId)
                .map(mapper::toDto);
    }

    public Page<SessionDto> getMySessions(UUID userId,
                                          @Nullable LocalDate from,
                                          @Nullable LocalDate to,
                                          @Nullable UUID activityTypeId,
                                          @Nullable Visibility visibility,
                                          @Nullable String status,
                                          Pageable pageable) {
        validateDateRange(from, to);
        SessionStatusFilter statusFilter = parseStatus(status);
        Specification<Session> spec = buildMySessionsSpec(userId, from, to, activityTypeId, visibility, statusFilter);
        return sessionRepo.findAll(spec, pageable).map(mapper::toDto);
    }

    @Transactional
    public MeDashboardSummaryDto getMyDashboardSummary(UUID userId,
                                                       @Nullable LocalDate from,
                                                       @Nullable LocalDate to) {
        validateDateRange(from, to);

        Specification<Session> spec = buildMySessionsSpec(
                userId,
                from,
                to,
                null,
                null,
                SessionStatusFilter.ALL
        );

        List<Session> sessions = sessionRepo.findAll(spec);
        Instant now = Instant.now();

        long totalDurationSeconds = 0;
        Set<LocalDate> activeDays = new HashSet<>();
        Map<UUID, Long> durationByTypeId = new HashMap<>();

        for (Session session : sessions) {
            activeDays.add(session.getStartedAt().atOffset(ZoneOffset.UTC).toLocalDate());

            Instant end = session.getEndedAt() == null ? now : session.getEndedAt();
            long durationSeconds = Math.max(0, Duration.between(session.getStartedAt(), end).getSeconds());
            totalDurationSeconds += durationSeconds;

            UUID activityTypeId = session.getActivityType().getId();
            durationByTypeId.merge(activityTypeId, durationSeconds, Long::sum);
        }

        Map<UUID, String> typeNamesById = typeRepo.findAllById(durationByTypeId.keySet()).stream()
                .collect(Collectors.toMap(ActivityType::getId, ActivityType::getName, (a, b) -> a));

        List<TopActivityTypeByTimeDto> top = durationByTypeId.entrySet().stream()
                .sorted(
                        Comparator.<Map.Entry<UUID, Long>>comparingLong(Map.Entry::getValue)
                                .reversed()
                                .thenComparing(entry -> typeNamesById.getOrDefault(entry.getKey(), ""))
                                .thenComparing(Map.Entry::getKey)
                )
                .limit(3)
                .map(entry -> new TopActivityTypeByTimeDto(
                        entry.getKey(),
                        typeNamesById.getOrDefault(entry.getKey(), "Unknown"),
                        entry.getValue()
                ))
                .toList();

        return new MeDashboardSummaryDto(
                sessions.size(),
                totalDurationSeconds,
                activeDays.size(),
                top
        );
    }

    private void validateStopMetric(ActivityType activityType, BigDecimal metricValue) {
        MetricKind metricKind = activityType.getMetricKind() == null ? MetricKind.NONE : activityType.getMetricKind();

        if (metricKind == MetricKind.NONE && metricValue != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This activity type does not accept a metric value");
        }

        if (metricKind == MetricKind.INTEGER && metricValue != null && metricValue.stripTrailingZeros().scale() > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "metricValue must be a whole number for INTEGER metrics");
        }
    }

    private Specification<Session> byUserId(UUID userId) {
        return (root, query, cb) -> cb.equal(root.get("user").get("id"), userId);
    }

    private void validateDateRange(@Nullable LocalDate from, @Nullable LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'from' must be before or equal to 'to'");
        }
    }

    private Specification<Session> buildMySessionsSpec(UUID userId,
                                                       @Nullable LocalDate from,
                                                       @Nullable LocalDate to,
                                                       @Nullable UUID activityTypeId,
                                                       @Nullable Visibility visibility,
                                                       SessionStatusFilter statusFilter) {
        Specification<Session> spec = Specification.where(byUserId(userId));

        if (from != null) {
            Instant fromInclusive = from.atStartOfDay().toInstant(ZoneOffset.UTC);
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("startedAt"), fromInclusive));
        }
        if (to != null) {
            Instant toExclusive = to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            spec = spec.and((root, query, cb) -> cb.lessThan(root.get("startedAt"), toExclusive));
        }
        if (activityTypeId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("activityType").get("id"), activityTypeId));
        }
        if (visibility != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("visibility"), visibility));
        }
        if (statusFilter == SessionStatusFilter.LIVE) {
            spec = spec.and((root, query, cb) -> cb.isNull(root.get("endedAt")));
        } else if (statusFilter == SessionStatusFilter.ENDED) {
            spec = spec.and((root, query, cb) -> cb.isNotNull(root.get("endedAt")));
        }

        return spec;
    }

    private SessionStatusFilter parseStatus(@Nullable String raw) {
        if (raw == null || raw.isBlank()) {
            return SessionStatusFilter.ALL;
        }
        try {
            return SessionStatusFilter.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status. Use LIVE, ENDED, or ALL");
        }
    }

    private enum SessionStatusFilter {
        LIVE,
        ENDED,
        ALL
    }
}
