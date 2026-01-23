package org.progresspalbackend.progresspalbackend.web;

import org.progresspalbackend.progresspalbackend.domain.Visibility;
import org.progresspalbackend.progresspalbackend.dto.session.SessionDto;
import org.progresspalbackend.progresspalbackend.service.SessionService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserSessionsController {
    SessionService sessionService;

    public UserSessionsController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping("/{userId}/sessions")
    public List<SessionDto> getUserSessions(@RequestHeader("X-User-Id") UUID actorUserId,
                                            @PathVariable UUID userId,
                                            @RequestParam(required = false) Visibility visibility) {
        return sessionService.findVisibleSessions(actorUserId, userId, visibility);
    }
}
