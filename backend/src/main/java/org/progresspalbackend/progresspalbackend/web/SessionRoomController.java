package org.progresspalbackend.progresspalbackend.web;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.config.CurrentUser;
import org.progresspalbackend.progresspalbackend.dto.session.RoomMessageCreateDto;
import org.progresspalbackend.progresspalbackend.dto.session.RoomMessageDto;
import org.progresspalbackend.progresspalbackend.dto.session.RoomStateDto;
import org.progresspalbackend.progresspalbackend.service.SessionJoinRoomService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/sessions/{sessionId}/room")
@RequiredArgsConstructor
public class SessionRoomController {

    private final SessionJoinRoomService sessionJoinRoomService;
    private final CurrentUser currentUser;

    @GetMapping
    public RoomStateDto state(Authentication authentication,
                              @PathVariable UUID sessionId) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionJoinRoomService.roomState(actorUserId, sessionId);
    }

    @GetMapping("/messages")
    public Page<RoomMessageDto> messages(Authentication authentication,
                                         @PathVariable UUID sessionId,
                                         @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
                                         Pageable pageable) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionJoinRoomService.listRoomMessages(actorUserId, sessionId, pageable);
    }

    @PostMapping("/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomMessageDto createMessage(Authentication authentication,
                                        @PathVariable UUID sessionId,
                                        @RequestBody RoomMessageCreateDto body) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionJoinRoomService.createRoomMessage(actorUserId, sessionId, body);
    }
}
