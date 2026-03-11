package org.progresspalbackend.progresspalbackend.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.config.CurrentUser;
import org.progresspalbackend.progresspalbackend.dto.session.JoinRequestDecisionDto;
import org.progresspalbackend.progresspalbackend.dto.session.SessionJoinRequestDto;
import org.progresspalbackend.progresspalbackend.service.SessionJoinRoomService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions/{sessionId}/join-requests")
@RequiredArgsConstructor
public class SessionJoinRequestController {

    private final SessionJoinRoomService sessionJoinRoomService;
    private final CurrentUser currentUser;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionJoinRequestDto create(Authentication authentication,
                                        @PathVariable UUID sessionId) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionJoinRoomService.createJoinRequest(actorUserId, sessionId);
    }

    @GetMapping("/incoming")
    public List<SessionJoinRequestDto> incoming(Authentication authentication,
                                                @PathVariable UUID sessionId) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionJoinRoomService.listIncoming(actorUserId, sessionId);
    }

    @PatchMapping("/{requestId}")
    public SessionJoinRequestDto decide(Authentication authentication,
                                        @PathVariable UUID sessionId,
                                        @PathVariable UUID requestId,
                                        @Valid @RequestBody JoinRequestDecisionDto body) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionJoinRoomService.decide(actorUserId, sessionId, requestId, body.decision());
    }
}
