package uts.focusgradient.android

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.View

class FocusGradientView(context: Context) : View(context) {
    init {
        background = GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT,
            intArrayOf(
                Color.rgb(79, 127, 227),
                Color.argb(184, 79, 127, 227),
                Color.argb(0, 79, 127, 227)
            )
        )
    }
}
