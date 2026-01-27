package org.progresspalbackend.progresspalbackend.web;

import org.progresspalbackend.progresspalbackend.dto.feed.FeedSessionDto;
import org.progresspalbackend.progresspalbackend.service.SessionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/feed")
public class FeedController {

    private final SessionService service;

    public FeedController(SessionService service) {
        this.service = service;
    }

    @GetMapping
    public List<FeedSessionDto> feed(){
        return service.getFeedSessions();
    }
}