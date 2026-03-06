package org.progresspalbackend.progresspalbackend.web;

import lombok.RequiredArgsConstructor;
import org.progresspalbackend.progresspalbackend.config.CurrentUser;
import org.progresspalbackend.progresspalbackend.dto.notification.NotificationDto;
import org.progresspalbackend.progresspalbackend.dto.notification.NotificationUnreadCountDto;
import org.progresspalbackend.progresspalbackend.service.NotificationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/me/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final CurrentUser currentUser;

    @GetMapping
    public Page<NotificationDto> list(Authentication authentication,
                                      @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        UUID userId = currentUser.id(authentication);
        return notificationService.list(userId, pageable);
    }

    @GetMapping("/unread-count")
    public NotificationUnreadCountDto unreadCount(Authentication authentication) {
        UUID userId = currentUser.id(authentication);
        return notificationService.unreadCount(userId);
    }

    @PatchMapping("/{notificationId}/read")
    public NotificationDto markRead(Authentication authentication,
                                    @PathVariable UUID notificationId) {
        UUID userId = currentUser.id(authentication);
        return notificationService.markRead(userId, notificationId);
    }

    @PatchMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(Authentication authentication) {
        UUID userId = currentUser.id(authentication);
        notificationService.markAllRead(userId);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearAll(Authentication authentication) {
        UUID userId = currentUser.id(authentication);
        notificationService.clearAll(userId);
    }
}
