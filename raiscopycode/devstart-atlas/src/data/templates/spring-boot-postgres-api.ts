import type { Template } from "../../types";

export const springBootPostgresApi: Template = {
  id: "spring-boot-postgres-api",
  title: "Spring Boot + PostgreSQL API",
  description:
    "Java 21 REST API with Spring Boot 3: Spring Data JPA, PostgreSQL, entity → repository → service → controller flow, validation, tests and Docker.",
  technologies: ["java", "spring-boot", "spring-data", "postgresql", "docker"],
  projectTypes: ["Web API", "REST API"],
  architectures: ["layered"],
  databases: ["postgresql"],
  difficulty: "intermediate",
  productionReady: true,
  prerequisites: ["JDK 21", "Docker (for PostgreSQL)"],
  estimatedSetupMinutes: 12,
  versions: [
    { name: "Java", version: "21" },
    { name: "Spring Boot", version: "3.x" },
  ],
  lastReviewed: "2026-09",
  tags: ["java", "spring", "spring boot", "postgres", "jpa", "rest"],
  patterns: ["repository", "dependency-injection"],
  recipes: ["docker-compose-postgres", "github-actions-ci", "health-checks"],
  relatedTemplates: ["dotnet-clean-architecture", "node-express-postgres-api"],
  zeroToRunning: ["01 Create project", "02 Configure database", "03 Add the code", "04 Run & test"],
  completeness: [
    { label: "Project creation", done: true },
    { label: "Dependencies", done: true },
    { label: "Folder structure", done: true },
    { label: "Configuration", done: true },
    { label: "Database", done: true },
    { label: "API endpoint", done: true },
    { label: "Testing", done: true },
    { label: "Docker", done: true },
    { label: "CI/CD", done: true },
    { label: "Kubernetes", done: false },
  ],
  nextSteps: [
    { label: "Add Spring Security + JWT", recipeId: "jwt-authentication" },
    { label: "Add Flyway migrations", recipeId: "db-migrations" },
    { label: "Add health checks (Actuator)", recipeId: "health-checks" },
    { label: "Add pagination (Pageable)", recipeId: "pagination" },
  ],
  steps: [
    {
      id: "create",
      title: "01 Create project",
      description:
        "Generate from Spring Initializr with web, data-jpa, postgresql and validation starters. The curl below hits the official start.spring.io API; using the website UI is equivalent.",
      commands: [
        {
          shell: "bash",
          provenance: "official",
          code: `curl -s https://start.spring.io/starter.zip \\
  -d type=maven-project -d language=java -d javaVersion=21 \\
  -d groupId=com.example -d artifactId=my-api -d name=my-api \\
  -d dependencies=web,data-jpa,postgresql,validation \\
  -o my-api.zip
unzip my-api.zip -d my-api && cd my-api`,
          description: "Generate and unpack the project",
        },
      ],
      notes: ["Structure follows the Maven convention: src/main/java/com/example/myapi plus src/main/resources."],
    },
    {
      id: "configure",
      title: "02 Configure database",
      description: "Start PostgreSQL and point Spring at it.",
      commands: [
        {
          shell: "bash",
          code: `docker run -d --name my-api-db \\
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=dev_only_password -e POSTGRES_DB=app \\
  -p 5432:5432 postgres:16-alpine`,
          description: "PostgreSQL in Docker",
        },
      ],
      files: [
        {
          path: "src/main/resources/application.yml",
          language: "yaml",
          description: "ddl-auto: update is a dev convenience; production uses Flyway migrations with ddl-auto: validate.",
          content: `spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/app
    username: app
    password: dev_only_password
  jpa:
    hibernate:
      ddl-auto: update
    open-in-view: false`,
        },
      ],
    },
    {
      id: "code",
      title: "03 Add the code",
      description: "Entity → repository → service → controller for users, plus a service test.",
      files: [
        {
          path: "src/main/java/com/example/myapi/user/User.java",
          language: "java",
          content: `package com.example.myapi.user;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected User() {} // JPA

    public User(String email, String name) {
        this.email = email.trim().toLowerCase();
        this.name = name.trim();
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}`,
        },
        {
          path: "src/main/java/com/example/myapi/user/UserRepository.java",
          language: "java",
          content: `package com.example.myapi.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
}`,
        },
        {
          path: "src/main/java/com/example/myapi/user/UserService.java",
          language: "java",
          content: `package com.example.myapi.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository users;

    public UserService(UserRepository users) {
        this.users = users;
    }

    @Transactional
    public User create(String email, String name) {
        users.findByEmail(email.trim().toLowerCase()).ifPresent(u -> {
            throw new EmailTakenException();
        });
        return users.save(new User(email, name));
    }

    @Transactional(readOnly = true)
    public Optional<User> findById(UUID id) {
        return users.findById(id);
    }

    public static class EmailTakenException extends RuntimeException {}
}`,
        },
        {
          path: "src/main/java/com/example/myapi/user/UserController.java",
          language: "java",
          content: `package com.example.myapi.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    public record CreateUserRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(max = 100) String name) {}

    @PostMapping
    public ResponseEntity<User> create(@Valid @RequestBody CreateUserRequest request) {
        User user = userService.create(request.email(), request.name());
        return ResponseEntity.created(URI.create("/api/users/" + user.getId())).body(user);
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getById(@PathVariable UUID id) {
        return userService.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @ExceptionHandler(UserService.EmailTakenException.class)
    public ResponseEntity<Object> emailTaken() {
        return ResponseEntity.status(409).body(java.util.Map.of("error", "email_taken"));
    }
}`,
        },
        {
          path: "src/test/java/com/example/myapi/user/UserServiceTest.java",
          language: "java",
          description: "Service test with a mocked repository.",
          content: `package com.example.myapi.user;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class UserServiceTest {

    private final UserRepository repo = mock(UserRepository.class);
    private final UserService service = new UserService(repo);

    @Test
    void createSavesNewUser() {
        when(repo.findByEmail("ada@example.com")).thenReturn(Optional.empty());
        when(repo.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User user = service.create("Ada@Example.com", "Ada");

        assertThat(user.getEmail()).isEqualTo("ada@example.com");
        verify(repo).save(any(User.class));
    }

    @Test
    void createRejectsDuplicateEmail() {
        when(repo.findByEmail("ada@example.com"))
            .thenReturn(Optional.of(new User("ada@example.com", "Ada")));

        assertThatThrownBy(() -> service.create("ada@example.com", "Other"))
            .isInstanceOf(UserService.EmailTakenException.class);
    }
}`,
        },
      ],
    },
    {
      id: "run",
      title: "04 Run & test",
      description: "Run with the Maven wrapper included in the generated project.",
      commands: [
        { shell: "bash", provenance: "official", code: "./mvnw spring-boot:run", description: "Start the API (Windows: mvnw.cmd spring-boot:run)" },
        {
          shell: "bash",
          code: `curl -s -X POST http://localhost:8080/api/users \\
  -H "Content-Type: application/json" \\
  -d '{"email":"ada@example.com","name":"Ada Lovelace"}' | jq`,
          description: "Create a user",
        },
        { shell: "bash", code: "./mvnw test", description: "Run tests" },
      ],
    },
    {
      id: "docker",
      title: "05 Docker",
      description: "Multi-stage build producing a slim runtime image.",
      files: [
        {
          path: "Dockerfile",
          language: "dockerfile",
          content: `FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN ./mvnw -q package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]`,
        },
      ],
    },
    {
      id: "production",
      title: "06 Production checklist",
      description: "Before real traffic:",
      notes: [
        "Switch ddl-auto to validate and adopt Flyway migrations.",
        "Externalize credentials (SPRING_DATASOURCE_* env vars or a secret manager).",
        "Add spring-boot-starter-actuator for /actuator/health liveness+readiness.",
        "Add Spring Security for auth; the default permit-all is dev-only.",
      ],
    },
  ],
  files: [],
};
