package org.progresspalbackend.progresspalbackend.web;


import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.dto.dashboard.MeDashboardByActivityTypeDto;
import org.progresspalbackend.progresspalbackend.dto.dashboard.MeDashboardSummaryDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionDto;
import org.progresspalbackend.progresspalbackend.service.SessionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final SessionService sessionService;

    public MeController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping("/sessions")
    Page<SessionDto> getSessions(@RequestHeader("X-User-Id") UUID userId,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                 @RequestParam(required = false) UUID activityTypeId,
                                 @RequestParam(required = false) Visibility visibility,
                                 @RequestParam(required = false) String status,
                                 @PageableDefault(size = DEFAULT_SIZE, sort = "startedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return sessionService.getMySessions(
                userId,
                from,
                to,
                activityTypeId,
                visibility,
                status,
                clampPageable(pageable)
        );
    }

    @GetMapping("/dashboard/summary")
    MeDashboardSummaryDto getDashboardSummary(@RequestHeader("X-User-Id") UUID userId,
                                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return sessionService.getMyDashboardSummary(userId, from, to);
    }

    @GetMapping("/dashboard/by-activity-type")
    List<MeDashboardByActivityTypeDto> getDashboardByActivityType(@RequestHeader("X-User-Id") UUID userId,
                                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return sessionService.getMyDashboardByActivityType(userId, from, to);
    }

    private Pageable clampPageable(Pageable pageable) {
        int page = Math.max(pageable.getPageNumber(), 0);
        int requestedSize = pageable.getPageSize();
        int size = requestedSize <= 0 ? DEFAULT_SIZE : Math.min(requestedSize, MAX_PAGE_SIZE);
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "startedAt"));
    }
}
