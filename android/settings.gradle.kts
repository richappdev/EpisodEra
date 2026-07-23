pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "EpisodEra"

include(":app")
include(":core:model")
include(":core:network")
include(":core:design")
include(":feature:auth")
include(":feature:home")
include(":feature:search")
include(":feature:detail")
include(":feature:watchlist")
include(":feature:likes")
include(":feature:timeline")
include(":feature:profile")
include(":feature:settings")
include(":feature:social")
include(":feature:puzzle")
include(":feature:franchises")
