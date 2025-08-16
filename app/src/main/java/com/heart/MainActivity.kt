package com.heart

import android.graphics.Typeface
import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Simple UI wiring
        val titleView: TextView = findViewById(R.id.title)
        titleView.text = "Heart"
        titleView.setTypeface(titleView.typeface, Typeface.BOLD)
    }
}
