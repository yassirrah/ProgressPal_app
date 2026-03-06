package org.progresspalbackend.progresspalbackend.web;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.config.CurrentUser;
import org.progresspalbackend.progresspalbackend.dto.reaction.SessionLikeSummaryDto;
import org.progresspalbackend.progresspalbackend.service.SessionReactionService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/sessions/{sessionId}/likes")
@RequiredArgsConstructor
public class SessionReactionController {

    private final SessionReactionService sessionReactionService;
    private final CurrentUser currentUser;

    @GetMapping
    public SessionLikeSummaryDto getSummary(Authentication authentication,
                                            @PathVariable UUID sessionId) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionReactionService.getLikesSummary(actorUserId, sessionId);
    }

    @PutMapping
    public SessionLikeSummaryDto like(Authentication authentication,
                                      @PathVariable UUID sessionId) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionReactionService.like(actorUserId, sessionId);
    }

    @DeleteMapping
    public SessionLikeSummaryDto unlike(Authentication authentication,
                                        @PathVariable UUID sessionId) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionReactionService.unlike(actorUserId, sessionId);
    }
}
