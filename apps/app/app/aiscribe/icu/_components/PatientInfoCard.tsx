'use client';

import { Badge } from '@repo/design-system/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/design-system/components/ui/select';
import { useEffect, useState } from 'react';

interface PatientInfo {
  name: string;
  gender: string;
  diagnosis?: string;
  status?: string;
  extractedInfo?: {
    age?: string;
    room?: string;
    doctor?: string;
    admissionDate?: string;
  };
}

export function PatientInfoCard() {
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    gender: '',
  });

  // Lokale Speicherung beim Laden der Komponente
  useEffect(() => {
    const savedInfo = localStorage.getItem('icu-patient-info');
    if (savedInfo) {
      try {
        const parsed = JSON.parse(savedInfo);
        setPatientInfo(parsed);
      } catch (error) {
        console.error('Fehler beim Laden der Patienteninformationen:', error);
      }
    }
  }, []);

  // Lokale Speicherung bei Änderungen
  const updatePatientInfo = (updates: Partial<PatientInfo>) => {
    const newInfo = { ...patientInfo, ...updates };
    setPatientInfo(newInfo);

    // Nur lokale Speicherung, keine Server-Übertragung
    localStorage.setItem('icu-patient-info', JSON.stringify(newInfo));
  };

  const handleClearData = () => {
    const emptyInfo = { name: '', gender: '' };
    setPatientInfo(emptyInfo);
    localStorage.removeItem('icu-patient-info');
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-foreground">
          Patienteninformationen
          {(patientInfo.name || patientInfo.gender) && (
            <button
              type="button"
              onClick={handleClearData}
              className="text-muted-foreground text-xs hover:text-foreground"
            >
              Löschen
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Eingabefelder für Name und Geschlecht */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="patient-name" className="text-foreground">
              Name
            </Label>
            <Input
              id="patient-name"
              placeholder="Patient Name eingeben..."
              value={patientInfo.name}
              onChange={(e) => updatePatientInfo({ name: e.target.value })}
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-solarized-blue focus:ring-solarized-blue"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="patient-gender" className="text-foreground">
              Geschlecht
            </Label>
            <Select
              value={patientInfo.gender}
              onValueChange={(value) => updatePatientInfo({ gender: value })}
            >
              <SelectTrigger className="border-input bg-background text-foreground focus:border-solarized-blue focus:ring-solarized-blue">
                <SelectValue placeholder="Geschlecht auswählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="männlich">männlich</SelectItem>
                <SelectItem value="weiblich">weiblich</SelectItem>
                <SelectItem value="divers">divers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Automatisch erkannte/extrahierte Informationen */}
        <div className="border-t pt-4">
          <h4 className="mb-3 font-medium text-foreground text-sm">
            Erkannte Informationen
          </h4>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {patientInfo.extractedInfo?.age && (
              <>
                <div className="text-muted-foreground">Alter:</div>
                <div className="text-foreground">
                  {patientInfo.extractedInfo.age}
                </div>
              </>
            )}

            {patientInfo.diagnosis && (
              <>
                <div className="text-muted-foreground">Diagnose:</div>
                <div className="text-foreground">{patientInfo.diagnosis}</div>
              </>
            )}

            {patientInfo.status && (
              <>
                <div className="text-muted-foreground">Status:</div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      patientInfo.status === 'Stabil'
                        ? 'outline'
                        : 'destructive'
                    }
                    className="border-solarized-green/20 bg-solarized-green/10 text-solarized-green"
                  >
                    {patientInfo.status}
                  </Badge>
                </div>
              </>
            )}

            {patientInfo.extractedInfo?.room && (
              <>
                <div className="text-muted-foreground">Zimmer:</div>
                <div className="text-foreground">
                  {patientInfo.extractedInfo.room}
                </div>
              </>
            )}

            {patientInfo.extractedInfo?.doctor && (
              <>
                <div className="text-muted-foreground">Behandelnder Arzt:</div>
                <div className="text-foreground">
                  {patientInfo.extractedInfo.doctor}
                </div>
              </>
            )}

            {patientInfo.extractedInfo?.admissionDate && (
              <>
                <div className="text-muted-foreground">Aufnahmedatum:</div>
                <div className="text-foreground">
                  {patientInfo.extractedInfo.admissionDate}
                </div>
              </>
            )}
          </div>

          {!patientInfo.diagnosis &&
            !patientInfo.extractedInfo?.age &&
            !patientInfo.status && (
              <div className="rounded-md bg-muted/30 p-3 text-center">
                <p className="text-muted-foreground text-xs">
                  Informationen werden automatisch aus den Patientennotizen
                  extrahiert
                </p>
              </div>
            )}
        </div>

        {/* Datenschutzhinweis */}
        <div className="rounded-lg bg-solarized-green/10 p-3 text-xs">
          <p className="text-solarized-green">
            🔒 Alle Daten werden nur lokal gespeichert und niemals an Server
            übertragen
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
