# EpisodEra local Docker image: Node 22 + Java (Firestore emulator) + Firebase tools.
# Targets:
#   emulators — Auth / Functions / Firestore emulator suite (default)
#   web       — Vite dev server for browser testing against published emulator ports

# firebase-tools requires JDK 21+; Debian bookworm only ships OpenJDK 17 in apt.
FROM eclipse-temurin:21-jre-jammy AS jre

FROM node:22-bookworm AS emulators

COPY --from=jre /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY firebase.json .firebaserc firestore.rules firestore.indexes.json remote_config.json ./
COPY functions/package.json functions/package-lock.json ./functions/

WORKDIR /app/functions
RUN npm ci

COPY functions/ ./

ENV FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
ENV FIRESTORE_EMULATOR_HOST=127.0.0.1:8080

EXPOSE 4000 4400 4500 5001 8080 9099

CMD ["npm", "run", "serve"]

FROM node:22-bookworm AS web

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./

EXPOSE 5173

CMD ["npm", "run", "dev:docker"]