import React from 'react';
import { SafeAreaView, Text, StyleSheet, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Heart</Text>
      <View style={styles.playerBox}>
        <Text style={styles.track}>Now Playing</Text>
        <Text style={styles.song}>Your Song Here</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40
  },
  playerBox: {
    borderWidth: 1,
    borderColor: '#000',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center'
  },
  track: {
    fontSize: 18,
    marginBottom: 10
  },
  song: {
    fontSize: 20,
    fontWeight: '600'
  }
});
