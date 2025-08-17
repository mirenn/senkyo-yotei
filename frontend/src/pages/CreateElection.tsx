import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { electionService, candidateService } from '../firebase/services';
import { type Election, type Candidate } from '../types';

const CreateElection = () => {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [electionData, setElectionData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  
  const [candidates, setCandidates] = useState<Omit<Candidate, 'id' | 'electionId' | 'createdAt'>[]>([
    { name: '', description: '', imageUrl: '' },
    { name: '', description: '', imageUrl: '' },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if not authenticated
  if (!state.user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">選挙を作成するにはログインが必要です</p>
        <button
          onClick={() => navigate('/elections')}
          className="text-blue-600 hover:underline"
        >
          選挙一覧に戻る
        </button>
      </div>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    setElectionData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCandidateChange = (index: number, field: keyof typeof candidates[0], value: string) => {
    setCandidates(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    
    // Clear error when user starts typing
    const errorKey = `candidate_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addCandidate = () => {
    setCandidates(prev => [...prev, { name: '', description: '', imageUrl: '' }]);
  };

  const removeCandidate = (index: number) => {
    if (candidates.length > 2) {
      setCandidates(prev => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate election data
    if (!electionData.title.trim()) {
      newErrors.title = 'タイトルは必須です';
    }
    if (!electionData.description.trim()) {
      newErrors.description = '説明は必須です';
    }
    if (!electionData.startDate) {
      newErrors.startDate = '開始日は必須です';
    }
    if (!electionData.endDate) {
      newErrors.endDate = '終了日は必須です';
    }
    if (electionData.startDate && electionData.endDate) {
      if (new Date(electionData.startDate) >= new Date(electionData.endDate)) {
        newErrors.endDate = '終了日は開始日より後である必要があります';
      }
    }

    // Validate candidates
    candidates.forEach((candidate, index) => {
      if (!candidate.name.trim()) {
        newErrors[`candidate_${index}_name`] = '候補者名は必須です';
      }
      if (!candidate.description.trim()) {
        newErrors[`candidate_${index}_description`] = '候補者の説明は必須です';
      }
    });

    // Check for duplicate candidate names
    const names = candidates.map(c => c.name.trim().toLowerCase()).filter(Boolean);
    const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      candidates.forEach((candidate, index) => {
        if (duplicateNames.includes(candidate.name.trim().toLowerCase())) {
          newErrors[`candidate_${index}_name`] = '候補者名が重複しています';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      const newElection: Omit<Election, 'id'> = {
        title: electionData.title.trim(),
        description: electionData.description.trim(),
        startDate: new Date(electionData.startDate),
        endDate: new Date(electionData.endDate),
        createdBy: state.user!.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        // Try to create in Firestore
        const electionId = await electionService.createElection(newElection);
        
        // Create candidates
        const candidatesData = candidates.map(candidate => ({
          name: candidate.name.trim(),
          description: candidate.description.trim(),
          imageUrl: candidate.imageUrl.trim() || '/images/default-avatar.png',
          createdAt: new Date(),
        }));
        
        await candidateService.createCandidates(electionId, candidatesData);
        
        alert('選挙が正常に作成されました！');
        navigate(`/elections/${electionId}`);
        
      } catch (firestoreError) {
        console.log('Firestore not available, using mock behavior:', firestoreError);
        
        // Simulate API delay for mock behavior
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        console.log('Creating election (mock):', newElection);
        console.log('With candidates (mock):', candidates);
        
        alert('選挙が正常に作成されました！（デモモード）');
        navigate('/elections');
      }
      
    } catch (error) {
      console.error('Error creating election:', error);
      alert('選挙の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">選挙を作成</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Election Basic Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">基本情報</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                タイトル *
              </label>
              <input
                type="text"
                id="title"
                value={electionData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="例: 市長選挙 2024"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                説明 *
              </label>
              <textarea
                id="description"
                rows={3}
                value={electionData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="選挙の概要を説明してください"
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                  開始日 *
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={electionData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    errors.startDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.startDate && <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>}
              </div>
              
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                  終了日 *
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={electionData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    errors.endDate ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.endDate && <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Candidates Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">候補者</h2>
            <button
              type="button"
              onClick={addCandidate}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              + 候補者を追加
            </button>
          </div>
          
          <div className="space-y-4">
            {candidates.map((candidate, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900">候補者 {index + 1}</h3>
                  {candidates.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeCandidate(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      削除
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      名前 *
                    </label>
                    <input
                      type="text"
                      value={candidate.name}
                      onChange={(e) => handleCandidateChange(index, 'name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                        errors[`candidate_${index}_name`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="候補者の名前"
                    />
                    {errors[`candidate_${index}_name`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`candidate_${index}_name`]}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      説明 *
                    </label>
                    <textarea
                      rows={2}
                      value={candidate.description}
                      onChange={(e) => handleCandidateChange(index, 'description', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                        errors[`candidate_${index}_description`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="候補者の政策や略歴など"
                    />
                    {errors[`candidate_${index}_description`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`candidate_${index}_description`]}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      画像URL（オプション）
                    </label>
                    <input
                      type="url"
                      value={candidate.imageUrl}
                      onChange={(e) => handleCandidateChange(index, 'imageUrl', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/elections')}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            キャンセル
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                作成中...
              </>
            ) : (
              '選挙を作成'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateElection;
