// ChartComponent.js
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get("window").width;

export default function ChartComponent({ 
  title = "Training Load", 
  labels = ["Mon", "Tue", "Wed", "Thu", "Fri"], 
  data = [20, 45, 28, 80, 99], 
  color = "#3b82f6" 
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <LineChart
        data={{
          labels: labels,
          datasets: [
            {
              data: data,
              color: () => color, // line color
            }
          ]
        }}
        width={screenWidth - 32}
        height={220}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#f9fafb",
          backgroundGradientTo: "#f9fafb",
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
        }}
        bezier
        style={styles.chart}
      />
      <Text style={styles.legend}>Legend: {title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  chart: {
    borderRadius: 8,
  },
  legend: {
    marginTop: 8,
    fontSize: 14,
    color: "#374151",
  }
});