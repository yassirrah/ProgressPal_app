package org.progresspalbackend.progresspalbackend.web;

import org.progresspalbackend.progresspalbackend.dto.feed.FeedSessionDto;
import org.progresspalbackend.progresspalbackend.service.SessionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/feed")
public class FeedController {

    private final SessionService service;

    public FeedController(SessionService service) {
        this.service = service;
    }

    @GetMapping
    public Page<FeedSessionDto> feed(
            @RequestHeader("X-User-Id") UUID userId,
            @PageableDefault(size = 20, sort = "startedAt", direction = Sort.Direction.DESC)
            Pageable pageable){
        return service.getFeedSessions(userId, pageable);
    }
}
