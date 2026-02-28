package org.progresspalbackend.progresspalbackend.web;

import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.config.CurrentUser;
import org.progresspalbackend.progresspalbackend.dto.session.SessionDto;
import org.progresspalbackend.progresspalbackend.service.SessionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserSessionsController {
    SessionService sessionService;
    CurrentUser currentUser;

    public UserSessionsController(SessionService sessionService, CurrentUser currentUser) {
        this.sessionService = sessionService;
        this.currentUser = currentUser;
    }

    @GetMapping("/{userId}/sessions")
    public Page<SessionDto> getUserSessions(Authentication authentication,
                                            @PathVariable UUID userId,
                                            @RequestParam(required = false) Visibility visibility,
                                            @PageableDefault(size = 20, sort = "startedAt", direction = Sort.Direction.DESC) Pageable pageable) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionService.findVisibleSessions(actorUserId, userId, visibility, pageable);
    }
}
