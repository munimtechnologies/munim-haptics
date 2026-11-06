// Compile-only stand-ins for the AndroidX / fbjni / React classes that
// munim-haptics' Kotlin (and Nitro's core Kotlin) reference. Only used by
// kotlin-check.sh; never shipped.

@file:Suppress("unused")

package androidx.annotation {
  annotation class Keep
  annotation class CallSuper
  annotation class RequiresApi(val value: Int = 1, val api: Int = 1)
}

package com.facebook.proguard.annotations {
  annotation class DoNotStrip
}

package dalvik.annotation.optimization {
  annotation class FastNative
}

package com.facebook.jni {
  class HybridData {
    fun resetNative() {}
  }
}

package com.facebook.react.bridge {
  open class ReactApplicationContext(base: android.content.Context) : android.content.ContextWrapper(base) {
    val currentActivity: android.app.Activity? get() = null
  }
}

package com.margelo.nitro {
  class NitroModules {
    companion object {
      var applicationContext: com.facebook.react.bridge.ReactApplicationContext? = null
    }
  }
}
