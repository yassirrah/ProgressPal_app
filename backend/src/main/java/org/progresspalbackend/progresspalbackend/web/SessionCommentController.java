package org.progresspalbackend.progresspalbackend.web;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.config.CurrentUser;
import org.progresspalbackend.progresspalbackend.dto.comment.SessionCommentCreateDto;
import org.progresspalbackend.progresspalbackend.dto.comment.SessionCommentDto;
import org.progresspalbackend.progresspalbackend.service.SessionCommentService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions/{sessionId}/comments")
@RequiredArgsConstructor
public class SessionCommentController {

    private final SessionCommentService sessionCommentService;
    private final CurrentUser currentUser;

    @GetMapping
    public List<SessionCommentDto> list(Authentication authentication,
                                        @PathVariable UUID sessionId) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionCommentService.list(actorUserId, sessionId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SessionCommentDto create(Authentication authentication,
                                    @PathVariable UUID sessionId,
                                    @RequestBody SessionCommentCreateDto dto) {
        UUID actorUserId = currentUser.id(authentication);
        return sessionCommentService.create(actorUserId, sessionId, dto);
    }

    @DeleteMapping("/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication authentication,
                       @PathVariable UUID sessionId,
                       @PathVariable UUID commentId) {
        UUID actorUserId = currentUser.id(authentication);
        sessionCommentService.delete(actorUserId, sessionId, commentId);
    }
}
