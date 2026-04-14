package org.progresspalbackend.progresspalbackend.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.FileSystemResource;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

class TomcatAccessLogConfigTest {

    @Test
    void applicationYml_enablesTomcatAccessLogsWithStableOutputLocation() {
        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(new FileSystemResource("src/main/resources/application.yml"));

        Properties properties = factory.getObject();

        assertThat(properties).isNotNull();
        assertThat(properties.getProperty("server.tomcat.basedir"))
                .isEqualTo("${SERVER_TOMCAT_BASEDIR:./tomcat}");
        assertThat(properties.getProperty("server.tomcat.accesslog.enabled"))
                .isEqualTo("${SERVER_TOMCAT_ACCESSLOG_ENABLED:true}");
        assertThat(properties.getProperty("server.tomcat.accesslog.directory"))
                .isEqualTo("${SERVER_TOMCAT_ACCESSLOG_DIRECTORY:logs}");
        assertThat(properties.getProperty("server.tomcat.accesslog.pattern"))
                .contains("remote=%a")
                .contains("method=%m")
                .contains("path=%U")
                .contains("status=%s");
    }
}
