package org.progresspalbackend.progresspalbackend.dto.notification;

import org.progresspalbackend.progresspalbackend.domain.NotificationResourceType;
import org.progresspalbackend.progresspalbackend.domain.NotificationType;

import java.time.Instant;
import java.util.UUID;

public record NotificationDto(UUID id,
                              NotificationType type,
                              String message,
                              UUID actorId,
                              String actorUsername,
                              String actorProfileImage,
                              NotificationResourceType resourceType,
                              UUID resourceId,
                              Instant readAt,
                              Instant createdAt) {
}
