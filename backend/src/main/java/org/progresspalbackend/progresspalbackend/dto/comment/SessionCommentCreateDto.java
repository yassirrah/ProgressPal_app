package org.progresspalbackend.progresspalbackend.dto.comment;

import java.util.UUID;

public record SessionCommentCreateDto(String content,
                                      UUID parentCommentId) {
}
