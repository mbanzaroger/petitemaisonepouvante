# syntax=docker/dockerfile:1
# Étape 1 : compilation (image de build, non livrée)
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp -q package -DskipTests

# Étape 2 : exécution sur une image distroless (pas de shell ni de gestionnaire de paquets),
# utilisateur non root (politique de sécurité §4)
FROM gcr.io/distroless/java21-debian13:nonroot
WORKDIR /app
COPY --from=build /workspace/target/stock-service.jar /app/app.jar
EXPOSE 8083
USER 65532:65532
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
