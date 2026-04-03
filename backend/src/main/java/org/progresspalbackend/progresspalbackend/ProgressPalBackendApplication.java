package org.progresspalbackend.progresspalbackend;

import org.progresspalbackend.progresspalbackend.config.SessionFreshnessProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(SessionFreshnessProperties.class)
public class ProgressPalBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProgressPalBackendApplication.class, args);
    }

}
