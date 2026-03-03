FROM eclipse-temurin:17-jdk-jammy AS build

WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -q -DskipTests dependency:go-offline

COPY src/ src/
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

COPY --from=build /workspace/target/progress-pal-backend-*.jar /app/app.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -Dserver.port=${PORT:-8080} -jar /app/app.jar"]
