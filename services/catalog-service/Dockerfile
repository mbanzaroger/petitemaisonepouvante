# syntax=docker/dockerfile:1
# Étape 1 : compilation (image de build, non livrée)
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY src ./src
# -U : un échec de téléchargement mis en cache (ex. 429 de Maven Central) est retenté au lieu d'être rejoué ;
# jusqu'à 6 tentatives espacées sur 429 et 503.
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp -q -U \
    -Daether.connector.http.retryHandler.count=6 -Daether.connector.http.retryHandler.interval=10000 \
    package -DskipTests

# Étape 2 : exécution sur une image distroless (pas de shell ni de gestionnaire de paquets),
# utilisateur non root (politique de sécurité §4)
FROM gcr.io/distroless/java21-debian13:nonroot
WORKDIR /app
COPY --from=build /workspace/target/catalog-service.jar /app/app.jar
EXPOSE 8081
USER 65532:65532
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
