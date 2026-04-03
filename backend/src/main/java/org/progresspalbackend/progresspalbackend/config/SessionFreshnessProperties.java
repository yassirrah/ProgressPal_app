package org.progresspalbackend.progresspalbackend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.sessions.freshness")
public class SessionFreshnessProperties {

    private Duration heartbeatInterval = Duration.ofSeconds(45);
    private Duration staleAfter = Duration.ofMinutes(15);
    private Duration sweepInterval = Duration.ofSeconds(60);
}
