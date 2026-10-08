/**
 * Tests unitaires — Plateforme MLOps de prédiction du stress hydrique
 * Composants testés : ModelComparison, OrchestratorWizard
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

/* ── Mocks globaux ─────────────────────────────────────────────────────────── */

jest.mock('../../api/axios', () => ({
  apiUsers: {
    get:  jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  RadarChart:          ({ children }) => <div data-testid="radar-chart">{children}</div>,
  PolarGrid:           () => null,
  PolarAngleAxis:      () => null,
  PolarRadiusAxis:     () => null,
  Radar:               ({ name }) => <div data-testid={`radar-${name}`} />,
  Legend:              () => null,
  Tooltip:             () => null,
}));

jest.mock('lucide-react', () => ({
  RefreshCw:     () => <span />,
  Database:      () => <span />,
  Shield:        () => <span />,
  Brain:         () => <span />,
  Box:           () => <span />,
  Server:        () => <span />,
  BarChart3:     () => <span />,
  Target:        () => <span />,
  Rocket:        () => <span />,
  ChevronLeft:   () => <span />,
  ChevronRight:  () => <span />,
  SkipForward:   () => <span />,
  CheckCircle2:  () => <span />,
  Loader2:       () => <span />,
  AlertCircle:   () => <span />,
}));

jest.mock('./ScientistPages.css', () => ({}));

jest.mock('./PipelineConfigs', () => ({
  DatasetConfig:    ({ values }) => (
    <div data-testid="dataset-config">
      <span>start_year: {values.start_year}</span>
    </div>
  ),
  ValidationConfig: () => <div data-testid="validation-config" />,
  TrainingConfig:   () => <div data-testid="training-config" />,
  RegistryConfig:   () => <div data-testid="registry-config" />,
  ServingConfig:    () => <div data-testid="serving-config" />,
  MonitoringConfig: () => <div data-testid="monitoring-config" />,
  PredictConfig:    () => <div data-testid="predict-config" />,
}));

import { apiUsers } from '../../api/axios';
import ModelComparison    from './ModelComparison';
import OrchestratorWizard from './OrchestratorWizard';

/* ── Données de test ───────────────────────────────────────────────────────── */

const EVAL_DATA = {
  best_model: 'RandomForest',
  models: {
    RandomForest: { r2: 0.95, rmse: 0.010, mae: 0.008 },
    XGBoost:      { r2: 0.90, rmse: 0.020, mae: 0.015 },
    LightGBM:     { r2: 0.88, rmse: 0.025, mae: 0.018 },
    AdaBoost:     { r2: 0.80, rmse: 0.040, mae: 0.030 },
  },
};

const LIBRARY_DATA = {
  models: [
    { version: 'v1', name: 'RandomForest', status: 'production', r2: 0.95, created_at: '2024-01-01' },
    { version: 'v2', name: 'XGBoost',      status: 'staging',    r2: 0.90, created_at: '2024-02-01' },
  ],
};

function mockApiSuccess() {
  apiUsers.get.mockImplementation((url) => {
    if (url === '/training/status')     return Promise.resolve({ data: EVAL_DATA });
    if (url === '/models/library')      return Promise.resolve({ data: LIBRARY_DATA });
    if (url === '/projects/my-project') return Promise.reject();
    if (url === '/pipelines/config')    return Promise.resolve({ data: {} });
    return Promise.reject(new Error(`URL inconnue: ${url}`));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  apiUsers.post.mockResolvedValue({ data: {} });
});

/* ── Helper : attend que le chargement soit terminé ─────────────────────────── */

async function waitForModelComparison() {
  // Attend qu'au moins un modèle soit dans le tableau
  await waitFor(() => {
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });
}

async function waitForWizardReady() {
  await waitFor(() =>
    expect(screen.queryByText(/Chargement de la configuration/i)).not.toBeInTheDocument()
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   TEST 1 — ModelComparison : affichage des 4 modèles après chargement API
   ══════════════════════════════════════════════════════════════════════════════ */
describe('TEST 1 — ModelComparison : chargement et affichage des modèles', () => {

  test('affiche les 4 modèles entraînés dans le tableau des performances', async () => {
    mockApiSuccess();
    render(<ModelComparison />);

    // Écran de chargement visible en premier
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();

    // Après résolution API, le tableau contient les 4 modèles
    await waitForModelComparison();

    const table = screen.getByRole('table');
    expect(within(table).getByText('RandomForest')).toBeInTheDocument();
    expect(within(table).getByText('XGBoost')).toBeInTheDocument();
    expect(within(table).getByText('LightGBM')).toBeInTheDocument();
    expect(within(table).getByText('AdaBoost')).toBeInTheDocument();
  });

  test('met en évidence le meilleur modèle avec le badge "Best" et le statut Production', async () => {
    mockApiSuccess();
    render(<ModelComparison />);
    await waitForModelComparison();

    expect(screen.getByText(/⭐ Best/i)).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   TEST 2 — ModelComparison : règle métier MAX_COMPARE = 3
   ══════════════════════════════════════════════════════════════════════════════ */
describe('TEST 2 — ModelComparison : règle métier MAX_COMPARE = 3', () => {

  test('auto-sélectionne les 3 premiers modèles et laisse le 4ème non coché', async () => {
    mockApiSuccess();
    render(<ModelComparison />);
    await waitForModelComparison();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();     // RandomForest ✓
    expect(checkboxes[1]).toBeChecked();     // XGBoost      ✓
    expect(checkboxes[2]).toBeChecked();     // LightGBM     ✓
    expect(checkboxes[3]).not.toBeChecked(); // AdaBoost     ✗ (limite atteinte)
  });

  test('empêche la sélection d\'un 4ème modèle quand le maximum est déjà atteint', async () => {
    mockApiSuccess();
    render(<ModelComparison />);
    await waitForModelComparison();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[3]); // tenter de cocher AdaBoost
    expect(checkboxes[3]).not.toBeChecked(); // toujours bloqué
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   TEST 3 — ModelComparison : désélection et radar vide
   ══════════════════════════════════════════════════════════════════════════════ */
describe('TEST 3 — ModelComparison : gestion dynamique de la sélection', () => {

  test('permet de décocher un modèle sélectionné', async () => {
    mockApiSuccess();
    render(<ModelComparison />);
    await waitForModelComparison();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    fireEvent.click(checkboxes[0]); // décocher RandomForest
    expect(checkboxes[0]).not.toBeChecked();
  });

  test('affiche un message d\'invite quand aucun modèle n\'est sélectionné', async () => {
    mockApiSuccess();
    render(<ModelComparison />);
    await waitForModelComparison();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // décocher RandomForest
    fireEvent.click(checkboxes[1]); // décocher XGBoost
    fireEvent.click(checkboxes[2]); // décocher LightGBM

    expect(screen.getByText(/Sélectionnez au moins un modèle/i)).toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   TEST 4 — OrchestratorWizard : navigation entre les étapes
   ══════════════════════════════════════════════════════════════════════════════ */
describe('TEST 4 — OrchestratorWizard : navigation pas-à-pas', () => {

  test('démarre à l\'étape 1 (Dataset) et avance à l\'étape 2 (Validation) via le bouton Suivant', async () => {
    mockApiSuccess();
    render(<OrchestratorWizard />);
    await waitForWizardReady();

    expect(screen.getByText(/Dataset — Configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/Étape 1 \/ 7/i)).toBeInTheDocument();

    // Cliquer sur le bouton Suivant (pas le texte d'aide)
    fireEvent.click(screen.getByRole('button', { name: /Suivant/i }));

    await waitFor(() =>
      expect(screen.getByText(/Validation — Configuration/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Étape 2 \/ 7/i)).toBeInTheDocument();
  });

  test('le bouton Précédent est désactivé à la première étape', async () => {
    mockApiSuccess();
    render(<OrchestratorWizard />);
    await waitForWizardReady();

    expect(screen.getByRole('button', { name: /Précédent/i })).toBeDisabled();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   TEST 5 — OrchestratorWizard : skip et accès au résumé final
   ══════════════════════════════════════════════════════════════════════════════ */
describe('TEST 5 — OrchestratorWizard : skip d\'étapes et résumé', () => {

  test('le bouton Skip avance à l\'étape suivante sans appeler l\'API de sauvegarde', async () => {
    mockApiSuccess();
    render(<OrchestratorWizard />);
    await waitForWizardReady();

    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));

    await waitFor(() =>
      expect(screen.getByText(/Validation — Configuration/i)).toBeInTheDocument()
    );
    // POST de sauvegarde ne doit pas avoir été appelé
    expect(apiUsers.post).not.toHaveBeenCalled();
  });

  test('atteint l\'écran de résumé & lancement après avoir skippé les 7 étapes', async () => {
    mockApiSuccess();
    render(<OrchestratorWizard />);
    await waitForWizardReady();

    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
      await waitFor(() => {}); // laisser React re-rendre
    }

    await waitFor(() =>
      expect(screen.getByText(/Résumé de la configuration & Lancement/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /Lancer l'Orchestrator/i })).toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   TEST 6 — OrchestratorWizard : réinitialisation complète du wizard
   ══════════════════════════════════════════════════════════════════════════════ */
describe('TEST 6 — OrchestratorWizard : réinitialisation complète', () => {

  test('le bouton Recommencer ramène à l\'étape 1 depuis l\'étape 3', async () => {
    mockApiSuccess();
    render(<OrchestratorWizard />);
    await waitForWizardReady();

    // Avancer jusqu'à l'étape 3 via Skip
    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    await waitFor(() => screen.getByText(/Validation — Configuration/i));

    fireEvent.click(screen.getByRole('button', { name: /Skip/i }));
    await waitFor(() => screen.getByText(/Training — Configuration/i));

    // Réinitialiser
    fireEvent.click(screen.getByRole('button', { name: /Recommencer/i }));

    await waitFor(() =>
      expect(screen.getByText(/Dataset — Configuration/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Étape 1 \/ 7/i)).toBeInTheDocument();
  });
});
