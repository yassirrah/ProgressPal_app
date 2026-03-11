package org.progresspalbackend.progresspalbackend.web;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.config.CurrentUser;
import org.progresspalbackend.progresspalbackend.domain.SessionJoinRequestStatus;
import org.progresspalbackend.progresspalbackend.dto.session.MyJoinRequestDto;
import org.progresspalbackend.progresspalbackend.service.SessionJoinRoomService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/me/join-requests")
@RequiredArgsConstructor
public class MeJoinRequestController {

    private final SessionJoinRoomService sessionJoinRoomService;
    private final CurrentUser currentUser;

    @GetMapping("/outgoing")
    public List<MyJoinRequestDto> outgoing(Authentication authentication,
                                           @RequestParam(required = false) SessionJoinRequestStatus status,
                                           @RequestParam(defaultValue = "true") boolean liveOnly) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionJoinRoomService.listOutgoing(actorUserId, status, liveOnly);
    }
}
