#!/bin/zsh
# Compiles munim-haptics' Kotlin + nitrogen's Kotlin + Nitro's real core
# (Promise, HybridObject) against android.jar, with stubs for AndroidX /
# fbjni / React. Output goes to a temp dir that is deleted afterwards.
set -euo pipefail
LIB=${1:-$(cd "$(dirname "$0")/.." && pwd)}
# KOTLINC: an unpacked kotlin-compiler-*.zip (github.com/JetBrains/kotlin/releases).
KOTLINC=${KOTLINC:?set KOTLINC to the kotlinc directory}
SDK=${ANDROID_HOME:-$HOME/Library/Android/sdk}
JAR=${ANDROID_JAR:-$SDK/platforms/android-${ANDROID_PLATFORM:-37.0}/android.jar}
NM=$LIB/node_modules/react-native-nitro-modules/android/src/main/java/com/margelo/nitro
OUT=$(mktemp -d)
trap 'rm -rf $OUT' EXIT

# Kotlin stubs can't use the block-package syntax; split them per package.
STUBS=$OUT/stubs; mkdir -p $STUBS
awk -v dir=$STUBS '
  /^package [a-z.]+ \{/ { pkg=$2; file=dir "/" pkg ".kt"; print "package " pkg > file; next }
  /^\}$/ && pkg != "" { pkg=""; next }
  pkg != "" { sub(/^  /, ""); print >> file }
' "$(dirname "$0")/kotlin-stubs.kt"

$KOTLINC/bin/kotlinc -jvm-target 17 \
  -cp "$JAR:$KOTLINC/lib/kotlinx-coroutines-core-jvm.jar" \
  -d $OUT/classes \
  $STUBS/*.kt \
  $NM/core/Promise.kt $NM/core/HybridObject.kt \
  $(find $LIB/nitrogen/generated/android/kotlin -name '*.kt') \
  $(find $LIB/android/src/main/java -name '*.kt' ! -name 'MunimHapticsPackage.kt')
echo "== Kotlin OK ($(find $OUT/classes -name '*.class' | wc -l | tr -d ' ') classes)"
