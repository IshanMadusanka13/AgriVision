# app/services/planting/optimization.py
import numpy as np
import random
from typing import List, Dict

class PlantingOptimizer:
    """Genetic Algorithm optimizer for planting spacing - SIMPLE VERSION"""
    
    def optimize(self, area_m2: float, soil_score: float) -> Dict:
        """
        Optimize spacing using Genetic Algorithm
        
        Args:
            area_m2: Field area in square meters
            soil_score: Soil quality score (0-1)
        
        Returns:
            Dictionary with optimized spacing and fitness score
        """
        population = self._initialize_population(20)
        
        best_fitness = -float('inf')
        best_solution = None
        
        for generation in range(30):
            for individual in population:
                fitness = self._fitness(individual, area_m2, soil_score)
                
                if fitness > best_fitness:
                    best_fitness = fitness
                    best_solution = individual.copy()
            
            # Selection and reproduction
            population = self._evolve(population, area_m2, soil_score)
        
        if best_solution is None:
            # Default fallback
            best_solution = np.array([0.75, 0.60])
            best_fitness = self._fitness(best_solution, area_m2, soil_score)
        
        return {
            "optimized_row_spacing_m": round(float(best_solution[0]), 3),
            "optimized_plant_spacing_m": round(float(best_solution[1]), 3),
            "fitness_score": round(float(best_fitness), 4),
            "generations": 30
        }
    
    def _initialize_population(self, size: int) -> List[np.ndarray]:
        """Initialize population with random spacing values"""
        return [np.array([
            random.uniform(0.5, 1.2),  # Row spacing in meters
            random.uniform(0.4, 1.0)   # Plant spacing in meters
        ]) for _ in range(size)]
    
    def _fitness(self, individual: np.ndarray, area_m2: float, soil_score: float) -> float:
        """
        Calculate fitness score for a spacing configuration
        
        Args:
            individual: Array of [row_spacing, plant_spacing] in meters
            area_m2: Field area in square meters
            soil_score: Soil quality score (0-1)
        
        Returns:
            Fitness score (higher is better)
        """
        row, plant = individual
        
        # Penalize invalid spacing
        if row < 0.5 or plant < 0.4:
            return -1000
        
        # Calculate plants per square meter
        plants_per_m2 = 1 / (row * plant)
        
        # Total plants in field
        total_plants = plants_per_m2 * area_m2
        
        # Spacing efficiency (prefer spacing close to optimal: 0.75m x 0.6m)
        spacing_efficiency = np.exp(-((row - 0.75)**2 + (plant - 0.6)**2) / 0.1)
        
        # Fitness combines plant count, spacing efficiency, and soil quality
        return float(total_plants * spacing_efficiency * soil_score)
    
    def _evolve(self, population: List, area_m2: float, soil_score: float) -> List:
        """Evolve population through selection, crossover, and mutation"""
        # Tournament selection
        selected = []
        for _ in range(len(population)):
            tournament = random.sample(population, 3)
            fitnesses = [self._fitness(ind, area_m2, soil_score) for ind in tournament]
            selected.append(tournament[np.argmax(fitnesses)].copy())
        
        # Crossover
        offspring = []
        for i in range(0, len(selected), 2):
            if i + 1 < len(selected):
                p1, p2 = selected[i], selected[i + 1]
                if random.random() < 0.8:
                    point = random.randint(1, len(p1) - 1)
                    c1 = np.concatenate([p1[:point], p2[point:]])
                    c2 = np.concatenate([p2[:point], p1[point:]])
                    offspring.extend([c1, c2])
                else:
                    offspring.extend([p1.copy(), p2.copy()])
        
        # Mutation
        for i in range(len(offspring)):
            if random.random() < 0.1:
                offspring[i] += np.random.normal(0, 0.05, size=2)
                offspring[i][0] = max(0.5, min(1.2, offspring[i][0]))
                offspring[i][1] = max(0.4, min(1.0, offspring[i][1]))
        
        return offspring

# Singleton instance
planting_optimizer = PlantingOptimizer()